'use strict';

const handleRegistryErrorResponse = (expectedHttpStatus, res, data) => {
  if (res.statusCode == expectedHttpStatus) return;

  let error;
  try {
    error = JSON.parse(data);
  } catch (e) {
    throw new Error(`Schema registry error: no error in response; httpStatus is ${res.statusCode}`);
  }

  throw new Error(`Schema registry error: ${error.error_code} - ${error.message}`);
}

const getSchemaById = (registry, schemaId) => new Promise((resolve, reject) => {
  const {protocol, host, port, username, password, path, certificateAuthority} = registry;
  const requestOptions = {
    host,
    port,
    httpsAgent: new https.Agent({
      ca: certificateAuthority,
      rejectUnauthorized: false
    }),
    headers: {
      'Content-Type': 'application/vnd.schemaregistry.v1+json',
    },
    path: `${path}schemas/ids/${schemaId}`,
    auth: username && password ? `${username}:${password}` : null,
  };
  const req = protocol.request(requestOptions, (res) => {
    let data = '';
    res.on('data', (d) => {
      data += d;
    });
    res.on('error', (e) => {
      reject(e);
    });
    res.on('end', () => {
      try {
        handleRegistryErrorResponse(200, res, data);
      } catch (e) {
        return reject(e);
      }

      const schema = JSON.parse(data).schema;

      resolve(schema);
    });
  }).on('error', (e) => {
    reject(e);
  });
  req.end();
});

const pushSchema = (registry, subject, schema) => new Promise((resolve, reject) => {
  const {protocol, host, port, username, password, path} = registry;
  const body = JSON.stringify({schema: JSON.stringify(schema)});
  const requestOptions = {
    method: 'POST',
    host,
    port,
    httpsAgent: new https.Agent({
      ca: certificateAuthority,
      rejectUnauthorized: false
    }),
    headers: {
      'Content-Type': 'application/vnd.schemaregistry.v1+json',
      'Content-Length': Buffer.byteLength(body),
    },
    path: `${path}subjects/${subject}/versions`,
    auth: username && password ? `${username}:${password}` : null,
  };

  const req = protocol.request(requestOptions, (res) => {
    let data = '';
    res.on('data', (d) => {
      data += d;
    });
    res.on('error', (e) => {
      reject(e);
    });
    res.on('end', () => {
      try {
        handleRegistryErrorResponse(200, res, data);
      } catch (e) {
        return reject(e);
      }
      const resp = JSON.parse(data);

      resolve(resp.id);
    });
  }).on('error', (e) => {
    reject(e);
  });
  req.write(body);
  req.end();
});

const getLatestVersionForSubject = (registry, subject) => new Promise((resolve, reject) => {
  const {protocol, host, port, username, password, path} = registry;
  const requestOptions = {
    host,
    port,
    httpsAgent: new https.Agent({
      ca: certificateAuthority,
      rejectUnauthorized: false
    }),
    headers: {
      'Content-Type': 'application/vnd.schemaregistry.v1+json',
    },
    path: `${path}subjects/${subject}/versions`,
    auth: username && password ? `${username}:${password}` : null,
  };
  protocol.get(requestOptions, (res) => {
    let data = '';
    res.on('data', (d) => {
      data += d;
    });
    res.on('error', (e) => {
      reject(e);
    });
    res.on('end', () => {
      try {
        handleRegistryErrorResponse(200, res, data);
      } catch (e) {
        return reject(e);
      }
      const versions = JSON.parse(data);

      const requestOptions2 = Object.assign(requestOptions, {path: `${path}subjects/${subject}/versions/${versions.pop()}`});

      protocol.get(requestOptions2, (res2) => {
        let data = '';
        res2.on('data', (d) => {
          data += d;
        });
        res2.on('error', (e) => {
          reject(e);
        });
        res2.on('end', () => {
          try {
            handleRegistryErrorResponse(200, res, data);
          } catch (e) {
            return reject(e);
          }
          const responseBody = JSON.parse(data);

          resolve({schema: responseBody.schema, id: responseBody.id});
        });
      }).on('error', (e) => reject(e));
    });
  }).on('error', (e) => {
    reject(e);
  });
});

module.exports = {getSchemaById, pushSchema, getLatestVersionForSubject};
