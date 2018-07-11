# Repos and Recipes

CXXPODS works with `recipes` in repositories.  The global default repository is here: 
[github.com/cxxpods/cxxpods-registry](http://github.com/cxxpods/cxxpods-registry)

## Dependency/Recipe

Each dependency/recipe in a repo must contain a `cxxpods.yml` file at a minimum.  Assuming it needs to be findable as a library within `CMake`,  it also must have a finder template.  

### Recipe (cxxpods.yml)

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



### Finder Template

A finder template (as well as all templates used within CXXPODS) is a `Handlebars` template, i.e. `cmake/FindOpenCV.cmake.hbs`.

```cmake
if(NOT OpenCV_FOUND)
    set(_OpenCV_LIBS 
        calib3d features2d flann highgui imgcodecs
        imgproc ml objdetect photo shape stitching superres
        video videoio videostab core
        )


    foreach(_lib ${_OpenCV_LIBS})    
        set(_target OpenCV::${_lib})  
        set(_libPath {{cxxpodsLibDir}}/${CMAKE_STATIC_LIBRARY_PREFIX}opencv_${_lib}${CMAKE_STATIC_LIBRARY_SUFFIX})  
        
        list(APPEND OpenCV_LIBRARIES ${_libPath})
        list(APPEND OpenCV_TARGETS ${_target})
        if (NOT TARGET ${_target}) 
            add_library(${_target} STATIC IMPORTED)
            set_target_properties(${_target} PROPERTIES
                IMPORTED_LOCATION ${_libPath}
            )
        endif()
    endforeach()

    set(OpenCV_FOUND true)
endif()
```

#### Template Variables

- `cxxpodsLibDir` the install lib dir
- `cxxpodsIncludeDir` the install include dir



## Add your Own Repo

There are a large number of reasons to add your own recipe repos

- Custom configuration of recipes, examples include
  - Recipes configured for a Raspberry Pi specifically.
  - A different FFMPEG configuration that enables CUDA
  - OpenCV with Java/Python support
- Private recipes
  - **Yes we are happy for you to use CXXPODS commercially**
- Offline recipes

### Structure of a Repo

A repo is really in simplest terms, a folder with child folders that are each named respective to a given dependency, i.e. "opencv".

```bash
TOP OF REPO
| -> opencv
| | -> cmake
| | | -> FindOpenCV.cmake.hbs
| | -> cxxpods.yml
```



### Example Commands

_note_ you can add your own repos *public or private* both locally and git based as follows

```bash
# GITHUB EXAMPLE PUBLIC OR PRIVATE
cxxpods repo add https://github.com/myorg/my-cxxpods.git
# OR A LOCAL DIR
cxxpods repo add file:///var/cxxpods-local-on-disk
```



## 