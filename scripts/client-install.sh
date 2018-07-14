#!/usr/bin/env bash

set -e

CURL=$(which curl)
UNZIP=$(which unzip)
SUDO=$(which sudo)
TMPFILE=/tmp/cxxpods.zip

showUsage() {
	echo "curl, unzip and sudo must all be installed in order to install CXXPODS"
	exit -1
}

checkEmpty() {
	if [ "${1}" = "" ]; then
		showUsage
	fi
}

checkEmpty ${CURL}
checkEmpty ${UNZIP}
checkEmpty ${SUDO}

OS=linux
if [ "$(uname -s)" = "Darwin" ];then
	OS=macos
fi

URL=$(curl -s https://api.github.com/repos/cxxpods/cxxpods/releases/latest | grep ${OS} | grep url | awk '{ print $2 }' | sed 's/\"//g')

echo "Downloading for ${OS}: ${URL}"
curl -s -o ${TMPFILE} -L ${URL}

sudo mkdir -p /usr/local/bin
cd /usr/local/bin

if [ -e cxxpods-macos ];then
  echo "Removing old version"
	sudo rm cxxpods-macos
fi

if [ -e cxxpods ];then
  echo "Removing old version"
	sudo rm cxxpods
fi

echo "Unpacking new version"
sudo unzip ${TMPFILE}
sudo mv cxxpods-${OS} cxxpods

echo "Cleanup"
rm ${TMPFILE}

echo "Just type 'cxxpods' to get started"