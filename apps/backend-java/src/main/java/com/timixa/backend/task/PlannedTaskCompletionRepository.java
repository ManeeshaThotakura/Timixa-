package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PlannedTaskCompletionRepository
        extends JpaRepository<PlannedTaskCompletion, PlannedTaskCompletionId> {

    @Query("SELECT c.taskId FROM PlannedTaskCompletion c "
        + "WHERE c.taskId IN :taskIds AND c.completedDate = :date")
    List<UUID> findCompletedTaskIds(@Param("taskIds") Collection<UUID> taskIds,
                                    @Param("date") LocalDate date);

    List<PlannedTaskCompletion> findByTaskIdInAndCompletedDate(Collection<UUID> taskIds,
                                                                LocalDate date);

    java.util.Optional<PlannedTaskCompletion> findByTaskIdAndCompletedDate(UUID taskId,
                                                                           LocalDate date);

    List<PlannedTaskCompletion> findByTaskIdIn(Collection<UUID> taskIds);

    @Modifying
    @Transactional
    void deleteByTaskIdAndCompletedDate(UUID taskId, LocalDate completedDate);

    @Modifying
    @Transactional
    void deleteByTaskId(UUID taskId);
}
