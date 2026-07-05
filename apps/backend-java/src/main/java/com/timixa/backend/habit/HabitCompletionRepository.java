package com.timixa.backend.habit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HabitCompletionRepository
        extends JpaRepository<HabitCompletion, HabitCompletionId> {

    Optional<HabitCompletion> findByHabitIdAndCompletedDate(UUID habitId, LocalDate completedDate);

    List<HabitCompletion> findByHabitIdIn(Collection<UUID> habitIds);

    List<HabitCompletion> findByHabitIdInAndCompletedDate(Collection<UUID> habitIds, LocalDate completedDate);
}
