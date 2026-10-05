package com.cypher.gateway.repository;

import com.cypher.gateway.model.IncidentEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<IncidentEntity, Long> {
    @Query(value = "SELECT * FROM incidents WHERE metadata->>'eventId' = :eventId LIMIT 1", nativeQuery = true)
    Optional<IncidentEntity> findByEventId(@Param("eventId") String eventId);

    @EntityGraph(attributePaths = {"camera", "camera.project", "assignedTo"})
    List<IncidentEntity> findTop1000ByOrderByCreatedAtDesc();
    @EntityGraph(attributePaths = {"camera", "camera.project", "assignedTo"})
    List<IncidentEntity> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"camera", "camera.project", "assignedTo"})
    List<IncidentEntity> findByStatusOrderByCreatedAtDesc(String status);

    long countByStatus(String status);
    long countByPriority(String priority);
}
