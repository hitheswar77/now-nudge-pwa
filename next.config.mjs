import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Enable PWA in dev and prod so service workers and install prompt work during local demos.
  disable: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
