package com.timixa.backend.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface IssueRepository extends JpaRepository<Issue, UUID> {
    List<Issue> findByProjectIdInOrderByCreatedAtAsc(Collection<UUID> projectIds);
    List<Issue> findByProjectId(UUID projectId);
}
