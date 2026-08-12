#!/bin/bash
# 실제 avr-gcc + Arduino 코어로 스케치 하나를 컴파일 검증합니다.
# design doc §6.3 "2단계 자동 검증"의 실제 구현체.
# 사용법: compile-check.sh <sketch.cpp 경로> <출력 디렉터리>
set -e

SKETCH_CPP="$1"
OUT_DIR="$2"
MCU=atmega328p
FCPU=16000000L

CORE=/usr/share/arduino/hardware/arduino/avr/cores/arduino
VARIANT=/usr/share/arduino/hardware/arduino/avr/variants/standard

mkdir -p "$OUT_DIR"

CORE_OBJS=()
for f in "$CORE"/*.c; do
  obj="$OUT_DIR/$(basename "$f").o"
  avr-gcc -c -g -Os -w -std=gnu11 -ffunction-sections -fdata-sections -MMD \
    -DF_CPU=$FCPU -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR \
    -mmcu=$MCU -I"$CORE" -I"$VARIANT" "$f" -o "$obj"
  CORE_OBJS+=("$obj")
done
for f in "$CORE"/*.cpp; do
  obj="$OUT_DIR/$(basename "$f").o"
  avr-gcc -c -g -Os -w -std=gnu++11 -fno-exceptions -ffunction-sections -fdata-sections -fno-threadsafe-statics -MMD \
    -DF_CPU=$FCPU -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR \
    -mmcu=$MCU -I"$CORE" -I"$VARIANT" "$f" -o "$obj"
  CORE_OBJS+=("$obj")
done
for f in "$CORE"/*.S; do
  obj="$OUT_DIR/$(basename "$f").o"
  avr-gcc -c -g -x assembler-with-cpp -MMD \
    -DF_CPU=$FCPU -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR \
    -mmcu=$MCU -I"$CORE" -I"$VARIANT" "$f" -o "$obj"
  CORE_OBJS+=("$obj")
done

SKETCH_OBJ="$OUT_DIR/sketch.o"
avr-gcc -c -g -Os -Wall -std=gnu++11 -fno-exceptions -ffunction-sections -fdata-sections -fno-threadsafe-statics \
  -DF_CPU=$FCPU -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR \
  -mmcu=$MCU -I"$CORE" -I"$VARIANT" "$SKETCH_CPP" -o "$SKETCH_OBJ"

avr-gcc -Os -Wl,--gc-sections -mmcu=$MCU -o "$OUT_DIR/sketch.elf" "$SKETCH_OBJ" "${CORE_OBJS[@]}" -lm
avr-objcopy -O ihex -R .eeprom "$OUT_DIR/sketch.elf" "$OUT_DIR/sketch.hex"
avr-size "$OUT_DIR/sketch.elf"
