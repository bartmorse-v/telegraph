/** @type {import('next').NextConfig} */
export default {
  // The engine imports .js paths that resolve to .ts sources; Next handles that
  // natively. Body size is raised because a matter can be tens of megabytes of
  // scanned PDFs arriving in one request.
  experimental: { serverActions: { bodySizeLimit: "128mb" } },
};
