# Android

CXXPODS supports Android out of the box.  Simply add `android: true` to your `cxxpods.yml`, also you will likely want to exclude the host toolchain as well.  Below is a very brief example.

## Android vs Cross-Compilation

The primary difference, and it is significant, is that the dependencies are created/built when you run `Sync` in Android Studio as opposed to when you run `configure` normally.  Tools are still built during `configure`. 

## Config

The `cxxpods.yml` should be in the module folder of your project, not the root, i.e. `<root>/app/cxxpods.yml`.

```yaml
name: my-android-project
android: true
toolchainExcludeHost: true

dependencies:
	opencv: 3.4.1
```



## Configure

After creating your config file, you need to run `configure` before adding to your `CMakeLists.txt`.

```bash
# Get to your app modules
cd <root>/app

# Configure
cxxpods configure

```



## CMakeLists.txt

Just as you do with a regular project, add the `cxxpods.cmake` that was generated to your project.

```cmake
cmake_minimum_required(VERSION 3.10)

# INSERT THIS LINE
include(${CMAKE_CURRENT_LIST_DIR}/.cxxpods/cxxpods.cmake)

project(cxxpods_example)
```



