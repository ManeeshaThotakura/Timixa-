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

public interface PlannedTaskExceptionRepository
        extends JpaRepository<PlannedTaskException, PlannedTaskExceptionId> {

    List<PlannedTaskException> findByTaskIdIn(Collection<UUID> taskIds);

    List<PlannedTaskException> findByTaskIdAndExceptionDateBetween(
            UUID taskId, LocalDate from, LocalDate to);

    @Modifying
    @Transactional
    void deleteByTaskIdAndExceptionDate(UUID taskId, LocalDate exceptionDate);

    @Modifying
    @Transactional
    void deleteByTaskId(UUID taskId);
}
