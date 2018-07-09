

export const System = {
  Darwin: "Darwin",
  Linux: "Linux",
  Android: "Android",
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

export const CompilerType = {
  GCC: "GCC",
  Android: "Android",
  Clang: "Clang",
  MSVC: "MSVC"
}