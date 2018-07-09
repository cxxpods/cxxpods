import {Triplet} from "../project/Project"
import {CompilerType, Processor, System} from "../project/BuildConstants"


test("Triplet toString()", () => {
  expect(`${new Triplet(System.Android,Processor.aarch64,CompilerType.GNU)}`)
    .toBe(`${Processor.aarch64}-${System.Android.toLowerCase()}-${CompilerType.GNU.toLowerCase()}`)
})