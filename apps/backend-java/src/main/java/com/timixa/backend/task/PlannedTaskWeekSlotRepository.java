package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PlannedTaskWeekSlotRepository extends JpaRepository<PlannedTaskWeekSlot, UUID> {

    List<PlannedTaskWeekSlot> findByTaskIdInAndWeekday(Collection<UUID> taskIds, DayOfWeek weekday);

    List<PlannedTaskWeekSlot> findByTaskIdAndWeekday(UUID taskId, DayOfWeek weekday);

    List<PlannedTaskWeekSlot> findByTaskId(UUID taskId);

    @Modifying
    @Transactional
    void deleteByTaskIdAndWeekday(UUID taskId, DayOfWeek weekday);

    @Modifying
    @Transactional
    void deleteByTaskId(UUID taskId);
}
