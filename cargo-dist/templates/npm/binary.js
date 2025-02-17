const { Binary } = require("binary-install");
const os = require("os");
const cTable = require("console.table");
const libc = require("detect-libc");
const { configureProxy } = require("axios-proxy-builder");

const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

const { version } = require("./package.json");
// These are injected by cargo-dist
const name = "{{APP_NAME}}";
const artifact_download_url = "{{ARTIFACT_DOWNLOAD_URL}}";

// These are injected by cargo-dist
const supportedPlatforms = {/*PLATFORM_INFO*/};

const getPlatform = () => {
  const raw_os_type = os.type();
  const raw_architecture = os.arch();

  // We want to use rust-style target triples as the canonical key
  // for a platform, so translate the "os" library's concepts into rust ones
  let os_type = "";
  switch (raw_os_type) {
    case "Windows_NT":
      os_type = "pc-windows-msvc";
      break;
    case "Darwin":
      os_type = "apple-darwin";
      break;
    case "Linux":
      os_type = "unknown-linux-gnu"
      break;
  }

  let arch = "";
  switch (raw_architecture) {
    case "x64":
      arch = "x86_64";
      break;
    case "arm64":
      arch = "aarch64";
      break;
  }

  // Assume the above succeeded and build a target triple to look things up with.
  // If any of it failed, this lookup will fail and we'll handle it like normal.
  let target_triple = `${arch}-${os_type}`;
  let platform = supportedPlatforms[target_triple];

  if (!platform) {
    error(
      `Platform with type "${raw_os_type}" and architecture "${raw_architecture}" is not supported by ${name}.\nYour system must be one of the following:\n\n${Object.keys(supportedPlatforms).join(",")}`
    );
  }

  // These are both situation where you might toggle to unknown-linux-musl but we don't support that yet
  if (raw_os_type === "Linux") {
    if (libc.isNonGlibcLinuxSync()) {
      error("This operating system does not support dynamic linking to glibc.");
    } else {
      let libc_version = libc.versionSync();
      let split_libc_version = libc_version.split(".");
      let libc_major_version = split_libc_version[0];
      let libc_minor_version = split_libc_version[1];
      let min_major_version = 2;
      let min_minor_version = 17;
      if (
        libc_major_version < min_major_version ||
        libc_minor_version < min_minor_version
      ) {
        error(
          `This operating system needs glibc >= ${min_major_version}.${min_minor_version}, but only has ${libc_version} installed.`
        );
      }
    }
  }

  return platform;
};

const getBinary = () => {
  const platform = getPlatform();
  const url = `${artifact_download_url}/${platform.artifact_name}`;

  if (platform.bins.length > 1) {
    // Not yet supported
    error("this app has multiple binaries, which isn't yet implemented");
  }
  let binary = new Binary(platform.bins[0], url);

  return binary;
};

const install = (suppressLogs) => {
  const binary = getBinary();
  const proxy = configureProxy(binary.url);

  return binary.install(proxy, suppressLogs);
};

const run = () => {
  const binary = getBinary();
  binary.run();
};

module.exports = {
  install,
  run,
  getBinary,
};
