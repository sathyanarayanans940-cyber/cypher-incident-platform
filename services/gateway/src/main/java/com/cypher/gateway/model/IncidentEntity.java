package com.cypher.gateway.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(name = "incidents")
@Getter @Setter @NoArgsConstructor
public class IncidentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camera_id", nullable = false)
    private CameraEntity camera;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private UserEntity assignedTo;
    @Column(name = "incident_type", nullable = false)
    private String incidentType;
    @Column(nullable = false)
    private String priority = "LOW";
    @Column(nullable = false)
    private String status = "OPEN";
    @Column(name = "asset_type", nullable = false)
    private String assetType;
    @Column(nullable = false)
    private double confidence;
    @Column(nullable = false)
    private String summary;
    @Column(name = "snapshot_url")
    private String snapshotUrl;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bounding_box", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> boundingBox = new HashMap<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> metadata = new HashMap<>();
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
