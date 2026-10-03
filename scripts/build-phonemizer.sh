#!/usr/bin/env bash
set -euo pipefail
: "${EMSDK:?Activate pinned Emscripten 3.1.30 before building}"
root_dir="$(pwd)"
source_revision=0dfd1d77dd7f96ef1ea6856c9fa5cfac01599582
build_dir="$root_dir/.artifacts/phonemizer-build"
mkdir -p "$build_dir" "$root_dir/vendor/phonemizer"
git clone https://github.com/espeak-ng/espeak-ng.git "$build_dir/source"
git -C "$build_dir/source" checkout --detach "$source_revision"
cd "$build_dir/source"
./autogen.sh
./configure --prefix=/usr --without-pcaudiolib --without-async --without-mbrola --without-sonic --disable-shared --enable-static
make -j2
cp -R espeak-ng-data "$build_dir/compiled-data"
make distclean
emconfigure ./configure --prefix=/usr --without-pcaudiolib --without-async --without-mbrola --without-sonic --disable-shared --enable-static
emmake make -j2 src/libespeak-ng.la
emcc "$root_dir/vendor/phonemizer/reel-phonemizer.c" src/.libs/libespeak-ng.a -Isrc/include -O2 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=web,worker \
  -sWASM_ASYNC_COMPILATION=0 -sALLOW_MEMORY_GROWTH=1 -sDYNAMIC_EXECUTION=0 -sFILESYSTEM=1 \
  -sEXPORTED_FUNCTIONS='["_reel_phonemize","_reel_error","_reel_voices","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","UTF8ToString"]' \
  --embed-file "$build_dir/compiled-data@/usr/share/espeak-ng-data" \
  -o "$root_dir/vendor/phonemizer/engine.js"
cp COPYING COPYING.APACHE COPYING.BSD2 COPYING.UCD "$root_dir/vendor/phonemizer/"
# Before distribution, generate verified provenance manifest and a complete
# corresponding-source archive (upstream tree + binding + adapter + build scripts).

cd "$root_dir"
node scripts/phonemizer-provenance.mjs "$source_revision" "$(emcc --version | head -1)" "$build_dir/source"
