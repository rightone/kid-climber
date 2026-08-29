package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRunEmitsReadyEventAndServesHealth(t *testing.T) {
	if !cgoEnabled {
		t.Skip("go-sqlite3 integration test requires CGO")
	}

	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		reader.Close()
		writer.Close()
	})

	databasePath := filepath.Join(t.TempDir(), "kid-climber.db")
	errCh := make(chan error, 1)
	go func() {
		errCh <- run("127.0.0.1:0", databasePath, writer)
	}()

	readyCh := make(chan readyEvent, 1)
	go func() {
		var event readyEvent
		err := json.NewDecoder(bufio.NewReader(reader)).Decode(&event)
		if err == nil {
			readyCh <- event
		}
	}()

	var event readyEvent
	select {
	case event = <-readyCh:
	case err := <-errCh:
		t.Fatalf("server exited before readiness: %v", err)
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for readiness event")
	}

	if event.Event != "ready" {
		t.Fatalf("unexpected readiness event: %#v", event)
	}
	response, err := http.Get(event.APIURL[:len(event.APIURL)-len("/api")] + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("health returned %s", response.Status)
	}
	if _, err := os.Stat(databasePath); err != nil {
		t.Fatalf("database was not created at requested path: %v", err)
	}
}
