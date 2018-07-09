

export const System = {
  Darwin: "Darwin",
  Linux: "Linux",
  Android: "Android",
  Windows: "Windows"
}

export const Processor = {
  x86: "x86",
  x86_64: "x86_64",
  arm: "arm",
  aarch64: "aarch64"
}

export const ProcessorNodeMap = {
  [Processor.arm]: Processor.arm,
  "arm64-v8a": Processor.aarch64,
  "arm64": Processor.aarch64,
  "x64": Processor.x86_64,
  "x32": Processor.x86
}

export const CompilerType = {
  GNU: "GNU",
  Unknown: "Unknown",
  AppleClang: "AppleClang",
  MSVC: "MSVC"
}