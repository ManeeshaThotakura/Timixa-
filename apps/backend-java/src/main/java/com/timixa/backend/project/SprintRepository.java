package com.timixa.backend.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SprintRepository extends JpaRepository<Sprint, UUID> {
    List<Sprint> findByProjectIdInOrderByCreatedAtAsc(Collection<UUID> projectIds);
    List<Sprint> findByProjectId(UUID projectId);
}
