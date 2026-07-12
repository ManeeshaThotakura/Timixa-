package com.timixa.backend.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamMemberRepository extends JpaRepository<TeamMember, UUID> {
    Optional<TeamMember> findByUserId(UUID userId);
    List<TeamMember> findAllByOrderByNameAsc();
    long countByUserIdIsNull();
    Optional<TeamMember> findFirstByUserIdIsNullAndNameIgnoreCase(String name);
}
