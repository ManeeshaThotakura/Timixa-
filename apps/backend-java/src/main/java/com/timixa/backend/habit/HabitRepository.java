package com.timixa.backend.habit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HabitRepository extends JpaRepository<Habit, UUID> {
    List<Habit> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
