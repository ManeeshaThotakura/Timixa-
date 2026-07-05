package com.timixa.backend.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface IssueCommentRepository extends JpaRepository<IssueComment, UUID> {
    List<IssueComment> findByIssueIdInOrderByCreatedAtAsc(Collection<UUID> issueIds);
    List<IssueComment> findByIssueIdOrderByCreatedAtAsc(UUID issueId);
}
