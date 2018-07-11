![logo](../art/logo.png)

# CXXPODS

## Overview

CXXPods is a command line tool that allows for both simple c/c++ and very complex multi-platform, cross-compiling dependency managerment.  

Think of it as a highly customizable (obviously because it needs to support complex native code) NPM or Maven like package management solution that deals in source artifacts instead of compiled or binary artifacts.

It comes as an amalgamation of other attempts including awesome projects like mason, hunter & conan.

In order to be as comprehensive as possible, there is a single enforced guideline, your project must you CMake.

## Install

CXXPODS is implemented in JS for flexibility, so installation  anywhere is dead simple.

```bash
npm i -g cxxpods
```



## Quickstart

It takes a few simple steps.

- Create a cxxpods.yml file in the root of your project

```yaml
name: cxxpods-example

dependencies:
  opencv: 3.4.1

```

- Then run configure

```bash
cxxpods project configure
```

- In your root `CMakeLists.txt` *BEFORE* your `project` declaration 
  add something like the following:

```cmake
cmake_minimum_required(VERSION 3.10)

# INSERT THIS LINE
include(${CMAKE_CURRENT_LIST_DIR}/.cxxpods/cxxpods.cmake)

project(cxxpods_example)
```

