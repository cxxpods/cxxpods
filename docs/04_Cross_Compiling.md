## Cross-Compiling "Toolchains"

Create your standard cmake toolchain file and
use it as follows:

```yaml
name: cxxpods-example
profiles: [Debug,Release]

toolchains:
  "aarch64-linux-gnu": cmake/aarch64.cmake 
  # file would be at this relative location from the project root

dependencies:
  protobuf: 3.1.0
  opencv: 3.4.1

```

In order to use with `non-cmake` dependencies and scripts
add the following to the top of your toolchain file:

```cmake
include(${CMAKE_CURRENT_LIST_DIR}/.cxxpods/cxxpods.toolchain.cmake)
```

and add the following to the bottom of your toolchain file

```cmake
cxxpods_toolchain_export()
```

