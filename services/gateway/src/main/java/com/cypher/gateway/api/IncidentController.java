package com.cypher.gateway.api;

import com.cypher.gateway.model.IncidentEntity;
import com.cypher.gateway.repository.IncidentRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentRepository incidents;

    public IncidentController(IncidentRepository incidents) {
        this.incidents = incidents;
    }

    @GetMapping
    public List<IncidentView> list(@RequestParam(required = false) String status) {
        List<IncidentEntity> results = status == null || status.isBlank()
            ? incidents.findTop1000ByOrderByCreatedAtDesc()
            : incidents.findByStatusOrderByCreatedAtDesc(status.toUpperCase());
        return results.stream().map(IncidentView::from).toList();
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        IncidentEntity incident = incidents.findById(id).orElse(null);
        if (incident == null) return ResponseEntity.notFound().build();
        String next = request.status().toUpperCase();
        if (!List.of("OPEN", "ACKNOWLEDGED", "RESOLVED").contains(next)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported incident status"));
        }
        incident.setStatus(next);
        incident.setResolvedAt("RESOLVED".equals(next) ? Instant.now() : null);
        var metadata = new HashMap<>(incident.getMetadata());
        if (next.equals("ACKNOWLEDGED")) metadata.put("acknowledgedAt", Instant.now().toString());
        recordAction(metadata, next.equals("RESOLVED") ? "Incident resolved" : "Incident acknowledged");
        incident.setMetadata(metadata);
        return ResponseEntity.ok(IncidentView.from(incidents.save(incident)));
    }

    @PatchMapping("/{id}/review")
    @Transactional
    public ResponseEntity<?> review(@PathVariable Long id, @RequestBody Map<String, String> request) {
        var incident = incidents.findById(id).orElse(null);
        if (incident == null) return ResponseEntity.notFound().build();
        var metadata = new HashMap<>(incident.getMetadata());
        String action = request.getOrDefault("action", "");
        switch (action) {
            case "note" -> {
                String note = request.getOrDefault("note", "").trim();
                if (note.isEmpty() || note.length() > 2000) return ResponseEntity.badRequest().body(Map.of("message", "Note must contain 1–2000 characters"));
                recordAction(metadata, "Note: " + note);
            }
            case "assign" -> {
                metadata.put("assignee", "On-duty analyst");
                recordAction(metadata, "Assigned to on-duty analyst");
            }
            case "escalate" -> {
                incident.setPriority("CRITICAL");
                metadata.put("escalated", true);
                recordAction(metadata, "Escalated to critical priority");
            }
            case "false-positive" -> {
                incident.setStatus("RESOLVED");
                incident.setResolvedAt(Instant.now());
                metadata.put("falsePositive", true);
                recordAction(metadata, "Marked as false positive and resolved");
            }
            default -> { return ResponseEntity.badRequest().body(Map.of("message", "Unknown review action")); }
        }
        incident.setMetadata(metadata);
        return ResponseEntity.ok(IncidentView.from(incidents.save(incident)));
    }

    @SuppressWarnings("unchecked")
    private static void recordAction(Map<String, Object> metadata, String text) {
        var entries = new ArrayList<Map<String, Object>>((List<Map<String, Object>>) metadata.getOrDefault("timeline", List.of()));
        entries.add(Map.of("at", Instant.now().toString(), "text", text));
        if (entries.size() > 100) entries.remove(0);
        metadata.put("timeline", entries);
    }

    public record StatusRequest(@NotBlank String status) { }

    public record IncidentView(
        Long id, String incidentType, String priority, String status, String assetType,
        double confidence, String summary, Long cameraId, String cameraName, String location,
        Map<String, Object> boundingBox, Map<String, Object> metadata, Instant createdAt, Instant resolvedAt) {
        static IncidentView from(IncidentEntity incident) {
            return new IncidentView(incident.getId(), incident.getIncidentType(), incident.getPriority(),
                incident.getStatus(), incident.getAssetType(), incident.getConfidence(), incident.getSummary(),
                incident.getCamera().getId(), incident.getCamera().getName(), incident.getCamera().getLocation(),
                incident.getBoundingBox(), incident.getMetadata(), incident.getCreatedAt(), incident.getResolvedAt());
        }
    }
}
