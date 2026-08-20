const { PassThrough } = require("stream");

// Every PDF service in this app renders by calling `doc.pipe(destination)`
// then `doc.end()`, where `destination` is normally the Express response.
// That same shape works unchanged against an in-memory PassThrough, so this
// runs one of those render functions against a PassThrough instead and
// resolves with the finished PDF as a Buffer - used when a generated PDF
// needs to be uploaded to S3 rather than (or in addition to) streamed
// straight to the browser.
const renderPdfToBuffer = (streamFn, data) => {
  return new Promise((resolve, reject) => {
    const passThrough = new PassThrough();
    const chunks = [];
    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    streamFn(data, passThrough);
  });
};

module.exports = { renderPdfToBuffer };
