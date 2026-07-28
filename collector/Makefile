CC = clang
CFLAGS = -O2 -g -Wall
BPF_CFLAGS = -O2 -g -target bpf -D__TARGET_ARCH_x86
LDFLAGS = -lbpf -lelf -lz

BPF_DIR = bpf
SRC_DIR = src
BUILD_DIR = build

.PHONY: all clean

all: $(BUILD_DIR)/monitor.bpf.o $(SRC_DIR)/monitor.skel.h $(BUILD_DIR)/sentinel_collector

$(BUILD_DIR)/monitor.bpf.o: $(BPF_DIR)/monitor.bpf.c $(BPF_DIR)/vmlinux.h $(SRC_DIR)/events.h
	mkdir -p $(BUILD_DIR)
	$(CC) $(BPF_CFLAGS) -I. -I$(BPF_DIR) -c $< -o $@

$(SRC_DIR)/monitor.skel.h: $(BUILD_DIR)/monitor.bpf.o
	bpftool gen skeleton $< > $@

$(BUILD_DIR)/sentinel_collector: $(SRC_DIR)/main.c $(SRC_DIR)/monitor.skel.h $(SRC_DIR)/events.h
	mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -I. -I$(SRC_DIR) -o $@ $(SRC_DIR)/main.c $(LDFLAGS)

clean:
	rm -rf $(BUILD_DIR) $(SRC_DIR)/monitor.skel.h
