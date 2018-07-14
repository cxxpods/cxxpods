#!/usr/bin/env bash

set -e

BASE=$(realpath $(dirname $(dirname $(realpath ${0}))))
VERSION=$(node ${BASE}/scripts/get-version.js)
FPM=$(which fpm)
BUILD=${BASE}/build
ARTIFACTS=${BUILD}/artifacts

LINUX_APP=${BUILD}/cxxpods-linux
LINUX_ROOT=${BUILD}/linux-root

MACOS_APP=${BUILD}/cxxpods-macos
MACOS_ROOT=${BUILD}/macos-root

if [ "${VERSION}" = "" ]; then
	echo "Unable to resolve version"
	exit -1
fi

if [ ! -e ${FPM} ];then
	echo "FPM does not exist: ${FPM}"
	exit -1
fi

# MAKE LINUX FUNCTION
makeLinux() {
	if [ ! -e ${LINUX_APP} ];then
		echo "Linux app does not exist: ${LINUX_APP}"
		exit -1
	fi


	mkdir -p ${LINUX_ROOT}/usr/bin
	cp ${LINUX_APP} ${LINUX_ROOT}/usr/bin/cxxpods
	fpm \
		-s dir \
		-t deb \
		-n cxxpods \
		-v ${VERSION} \
		-C ${LINUX_ROOT} \
		-p ${ARTIFACTS}/cxxpods_VERSION_ARCH.deb \
		usr/bin

}

makeMacos() {
	if [ ! -e ${MACOS_APP} ];then
		echo "MacOS app does not exist: ${MACOS_APP}"
		exit -1
	fi


	mkdir -p ${MACOS_ROOT}/usr/local/bin
	cp ${MACOS_APP} ${MACOS_ROOT}/usr/local/bin/cxxpods
	fpm \
		-s dir \
		-t osxpkg \
		-n cxxpods \
		-v ${VERSION} \
		-C ${MACOS_ROOT} \
		-p ${ARTIFACTS}/cxxpods_VERSION_ARCH.pkg \
		usr/local/bin

}

mkdir -p ${ARTIFACTS}

makeLinux

if [ "$(which pkgbuild)" != "" ]; then
	echo "Building package for MacOS"
	makeMacos
fi




