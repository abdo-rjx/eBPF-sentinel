// SPDX-License-Identifier: GPL-2.0
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <bpf/libbpf.h>
#include "monitor.skel.h"
#include "events.h"

#define SOCKET_PATH_DEFAULT "/tmp/sentinel_collector.sock"

static volatile sig_atomic_t running = 1;
static int client_fd = -1;

static void handle_sigint(int sig) { (void)sig; running = 0; }

static int libbpf_print_fn(enum libbpf_print_level level, const char *format, va_list args) {
    if (level == LIBBPF_DEBUG) return 0;
    return vfprintf(stderr, format, args);
}

static int emit_event(const struct event *e) {
    if (client_fd < 0) return 0;

    static const char *type_names[] = {
        "", "execve", "connect", "accept", "openat", "unlink", "rename", "setuid"
    };
    const char *type_name = (e->event_type >= 1 && e->event_type <= 7)
        ? type_names[e->event_type] : "unknown";

    char line[1024];
    int n = snprintf(line, sizeof(line),
        "{\"ts\":%llu,\"pid\":%u,\"tid\":%u,\"ppid\":%u,\"uid\":%u,"
        "\"comm\":\"%s\",\"event_type\":\"%s\","
        "\"filename\":\"%s\",\"dst_ip\":%u,\"dst_port\":%u,\"target_uid\":%u}\n",
        (unsigned long long)e->timestamp_ns, e->pid, e->tid, e->ppid, e->uid,
        e->comm, type_name, e->filename, e->dst_ip, e->dst_port, e->target_uid);

    if (n < 0 || n >= (int)sizeof(line)) return -1;

    ssize_t written = write(client_fd, line, (size_t)n);
    if (written < 0) { close(client_fd); client_fd = -1; return -1; }
    return 0;
}

static int handle_ringbuf_event(void *ctx, void *data, size_t data_sz) {
    (void)ctx;
    if (data_sz < sizeof(struct event)) return 0;
    emit_event((const struct event *)data);
    return 0;
}

static int wait_for_client(int listen_fd) {
    fprintf(stderr, "[collector] waiting for backend to connect...\n");
    int fd = accept(listen_fd, NULL, NULL);
    if (fd < 0) { perror("accept"); return -1; }
    fprintf(stderr, "[collector] backend connected\n");
    return fd;
}

int main(int argc, char **argv) {
    const char *socket_path = getenv("SENTINEL_SOCKET_PATH");
    if (!socket_path) socket_path = SOCKET_PATH_DEFAULT;

    if (geteuid() != 0) {
        fprintf(stderr, "[collector] must run as root (or with CAP_BPF+CAP_PERFMON) "
                        "to load eBPF programs. See collector/run.sh.\n");
        return 1;
    }

    libbpf_set_print(libbpf_print_fn);
    signal(SIGINT, handle_sigint);
    signal(SIGTERM, handle_sigint);

    struct monitor_bpf *skel = monitor_bpf__open_and_load();
    if (!skel) { fprintf(stderr, "[collector] failed to open/load BPF skeleton\n"); return 1; }

    int err = monitor_bpf__attach(skel);
    if (err) { fprintf(stderr, "[collector] failed to attach: %d\n", err); monitor_bpf__destroy(skel); return 1; }

    unlink(socket_path);
    int listen_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un addr = { .sun_family = AF_UNIX };
    strncpy(addr.sun_path, socket_path, sizeof(addr.sun_path) - 1);
    if (bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind"); monitor_bpf__destroy(skel); return 1;
    }
    listen(listen_fd, 1);
    chmod(socket_path, 0666);

    struct ring_buffer *rb = ring_buffer__new(bpf_map__fd(skel->maps.events),
                                               handle_ringbuf_event, NULL, NULL);
    if (!rb) { fprintf(stderr, "[collector] failed to create ring buffer\n"); monitor_bpf__destroy(skel); return 1; }

    client_fd = wait_for_client(listen_fd);

    fprintf(stderr, "[collector] running. Ctrl-C to stop.\n");
    while (running) {
        int poll_err = ring_buffer__poll(rb, 200);
        if (poll_err < 0 && poll_err != -EINTR) {
            fprintf(stderr, "[collector] ring buffer poll error: %d\n", poll_err);
            break;
        }
        if (client_fd < 0) {
            client_fd = wait_for_client(listen_fd);
        }
    }

    ring_buffer__free(rb);
    monitor_bpf__destroy(skel);
    if (client_fd >= 0) close(client_fd);
    close(listen_fd);
    unlink(socket_path);
    return 0;
}
