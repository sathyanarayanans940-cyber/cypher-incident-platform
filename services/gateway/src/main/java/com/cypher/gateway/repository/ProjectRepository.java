package com.cypher.gateway.repository;

import com.cypher.gateway.model.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> { }

