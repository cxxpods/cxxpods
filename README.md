![logo](art/logo.png)

# CXXPODS 

CXXPods is the answer to c/c++ dependency management
in the CMake world.  It comes as an
amalgamation of other attempts including
awesome projects like mason, hunter & conan.

We feel that each of those projects have respective
shortcomings and based on all of them, we have
designed c-unit to be best in breed.

_note_ cxxpods has a strong emphasis on creating statically
linked binary distributions, therefore most default recipes
are for static compilation.  You are more than welcome
to create shared lib recipes and publish them.

Furthermore, you can issue `global` cmake override flags converting
all dependencies to shared libs 

## Install

cu is implemented in JS for flexibility, so installation 
anywhere is dead simple.

```bash
npm i -g cxxpods
```

## Repos and Recipes

cu works with `recipes` in repositories.  The global default repository is here: 
[github.com/cxxpods/cxxpods-registry](http://github.com/cxxpods/cxxpods-registry)

_note_ you can add your own repos *public or private* both locally and git based as follows

```bash
# GITHUB EXAMPLE PUBLIC OR PRIVATE
cxxpods repo add https://github.com/myorg/my-cxxpods.git
# OR A LOCAL DIR
cxxpods repo add file:///var/cxxpods-local-on-disk
```

A recipe is super simple
```yaml
name: opencv
repository: 
  url: https://github.com/opencv/opencv.git

cmake:
  flags:
    CMAKE_BUILD_TYPE: Release
    BUILD_SHARED_LIBS: OFF
    BUILD_JPEG: OFF
    BUILD_JASPER: OFF
    BUILD_PNG: ON
    BUILD_ZLIB: ON
    BUILD_IPP_IW: OFF
    BUILD_ITT: OFF
    BUILD_JAVA: OFF
    BUILD_PROTOBUF: OFF
    WITH_PROTOBUF: OFF
    WITH_CAROTENE: OFF
    WITH_CUBLAS: OFF
    WITH_CUDA: OFF
    WITH_CUFFT: OFF
    WITH_FFMPEG: OFF
    WITH_GPHOTO2: OFF
    WITH_GSTREAMER: OFF
    WITH_GTK: OFF
    WITH_ITT: OFF
    WITH_IPP: OFF
    WITH_JASPER: OFF
    WITH_LAPACK: OFF
    WITH_MATLAB: OFF
    WITH_NVCUVID: OFF
    WITH_OPENCL: OFF
    WITH_OPENCLAMDBLAS: OFF
    WITH_OPENCLAMDFFT: OFF
    WITH_OPENEXR: OFF
    WITH_PTHREADS_PF: OFF
    WITH_V4L: OFF
    WITH_WEBP: OFF
  findTemplate: cmake/FindOpenCV.cmake.hbs

dependencies:
  libtiff: Release-v4-0-9
  zlib: v1.2.11
  libpng: v1.6.33
  libjpeg: 8.4.0
```

## Quickstart

It takes a few simple steps.

* Create a cxxpods.yml file in the root of your project

```yaml
name: cxxpods-example

dependencies:
  protobuf: 3.1.0
  opencv: 3.4.1

tools:
	protobuf: 3.1.0
```

* Then run configure

```bash
cxxpods project configure
```

* In your root `CMakeLists.txt` *BEFORE* your `project` declaration 
add something like the following:

```cmake
cmake_minimum_required(VERSION 3.10)

# INSERT THIS LINE
include(${CMAKE_CURRENT_LIST_DIR}/.cxxpods/cxxpods.cmake)

project(cxxpods_example)
```

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