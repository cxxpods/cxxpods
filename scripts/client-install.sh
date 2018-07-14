#!/usr/bin/env bash

CURL=$(which curl)
UNZIP=$(which unzip)
SUDO=$(which sudo)

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

URL=$(curl -s https://api.github.com/repos/cxxpods/cxxpods/releases/latest | grep ${OS} | grep url | awk '{ print $2 }')

echo "Downloading for ${OS}: ${URL}"
curl -o /tmp/cxxpods.zip ${URL}

sudo mkdir -p /usr/local/bin
cd /usr/local/bin
sudo rm cxxpods

sudo unzip /tmp/cxxpods.zip
rm /tmp/cxxpods.zip