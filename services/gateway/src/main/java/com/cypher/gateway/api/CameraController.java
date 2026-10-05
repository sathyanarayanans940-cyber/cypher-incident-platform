package com.cypher.gateway.api;

import com.cypher.gateway.model.CameraEntity;
import com.cypher.gateway.repository.CameraRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import com.cypher.gateway.repository.ProjectRepository;

import java.util.List;

@RestController
@RequestMapping("/api/cameras")
public class CameraController {
    private final CameraRepository cameras;
    private final ProjectRepository projects;

    public CameraController(CameraRepository cameras, ProjectRepository projects) {
        this.cameras = cameras;
        this.projects = projects;
    }

    @GetMapping
    public List<CameraView> list() {
        return cameras.findAllByOrderByNameAsc().stream()
            .map(camera -> new CameraView(camera.getId(), camera.getName(), camera.getLocation(), camera.isActive(),
                camera.getProject().getName()))
            .toList();
    }

    public record CameraView(Long id, String name, String location, boolean active, String projectName) { }

    @PostMapping
    @Transactional
    public ResponseEntity<?> add(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        String location = body.getOrDefault("location", "").trim();
        if (name.isEmpty() || name.length() > 160 || location.length() > 255)
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a camera name and a valid location"));
        if (cameras.count() >= 12) return ResponseEntity.badRequest().body(Map.of("message", "Lightweight mode supports up to 12 simulated cameras"));
        var project = projects.findAll().stream().findFirst().orElseThrow();
        var camera = new CameraEntity();
        camera.setProject(project); camera.setName(name); camera.setLocation(location);
        camera.setStreamUrl("demo://simulation"); camera.setActive(true); camera.setCreatedAt(Instant.now());
        cameras.save(camera);
        return ResponseEntity.ok(new CameraView(camera.getId(), name, location, true, project.getName()));
    }

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        var camera = cameras.findById(id).orElse(null);
        if (camera == null) return ResponseEntity.notFound().build();
        camera.setActive(body.getOrDefault("active", camera.isActive()));
        cameras.save(camera);
        return ResponseEntity.ok(new CameraView(camera.getId(), camera.getName(), camera.getLocation(), camera.isActive(), camera.getProject().getName()));
    }
}
