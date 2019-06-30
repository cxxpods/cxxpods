

export const System = {
  Darwin: "Darwin",
  Linux: "Linux",
  Android: "Android",
  IOS: "IOS",
  Windows: "Windows"
}

export const Architecture = {
  x86: "x86",
  x86_64: "x86_64",
  arm: "arm",
  aarch64: "aarch64"
}

export const ProcessorNodeMap = {
  [Architecture.arm]: Architecture.arm,
  "arm64-v8a": Architecture.aarch64,
  "arm64": Architecture.aarch64,
  "x64": Architecture.x86_64,
  "x32": Architecture.x86
}


export const ABI = {
  GNU: "GNU",
  EABI: "EABI",
  ANDROID: "ANDROID",
  WINDOWS: "WINDOWS",
  ELF: "ELF",
  Unknown: "Unknown"
}

export const ArchToAndroidABIMap = {
  [Architecture.x86]: "x86",
  [Architecture.x86_64]: "x86_64",
  [Architecture.arm]: "armeabi-v7a",
  [Architecture.aarch64]: "arm64-v8a"
}

export const CompilerType = {
  GCC: "GCC",
  Android: "Android",
  Clang: "Clang",
  MSVC: "MSVC"
}

export function findSystem(system) {
  return Object.keys(System).find(it => it.toLowerCase() === system) || throw new Error(`Unknown system: ${system}`)
}

export function findArch(arch) {
  return Object.keys(Architecture).find(it => it.toLowerCase() === arch) || throw new Error(`Unknown arch: ${arch}`)
}

export function findABI(abi) {
  return Object.keys(ABI).find(it => it.toLowerCase() === abi)|| throw new Error(`Unknown system: ${abi}`)
}