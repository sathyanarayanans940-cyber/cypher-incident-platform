package com.cypher.gateway.repository;

import com.cypher.gateway.model.AlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<AlertEntity, Long> { }

