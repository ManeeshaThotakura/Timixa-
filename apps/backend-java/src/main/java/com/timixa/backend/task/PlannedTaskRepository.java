package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlannedTaskRepository extends JpaRepository<PlannedTask, UUID> {
    List<PlannedTask> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<PlannedTask> findByNotifyAtStartTrueAndStartTime(String startTime);

    List<PlannedTask> findByNotifyAtEndTrueAndEndTime(String endTime);
}
