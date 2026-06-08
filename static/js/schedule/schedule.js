/* ========================================
   SCHEDULE.JS - Schedule Management
   ======================================== */

const ScheduleManager = {
    state: {
        serverName: '',
        schedules: [],
        isLoading: false,
        currentEditingSchedule: null
    },

    /**
     * Initialize schedule manager
     */
    init(serverName) {
        this.state.serverName = serverName;
        this.initEventListeners();
        this.loadSchedules();
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        const createBtn = document.getElementById('createScheduleBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
    },

    /**
     * Load schedules from API
     */
    async loadSchedules() {
        this.state.isLoading = true;
        this.renderLoading();

        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/list`
            );

            const data = await response.json();

            if (data.success) {
                this.state.schedules = data.schedules || [];
                this.renderSchedules();
            } else {
                this.showError(data.error || 'Failed to load schedules');
                this.renderEmpty();
            }
        } catch (error) {
            console.error('Failed to load schedules:', error);
            this.showError('Failed to load schedules');
            this.renderEmpty();
        } finally {
            this.state.isLoading = false;
        }
    },

    /**
     * Render schedules list
     */
    renderSchedules() {
        const container = document.getElementById('scheduleListContainer');
        if (!container) return;

        // Clear container
        container.innerHTML = '';

        // If no schedules, show empty state
        if (this.state.schedules.length === 0) {
            this.renderEmpty();
            return;
        }

        // Render each schedule
        this.state.schedules.forEach(schedule => {
            const scheduleItem = this.createScheduleItem(schedule);
            container.appendChild(scheduleItem);
        });
    },

    /**
     * Create schedule item element
     */
    createScheduleItem(schedule) {
        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.dataset.scheduleId = schedule.id;

        // Icon
        const icon = document.createElement('div');
        icon.className = 'schedule-item-icon';
        icon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        `;

        // Info
        const info = document.createElement('div');
        info.className = 'schedule-item-info';
        info.innerHTML = `
            <div class="schedule-item-name">${this.escapeHtml(schedule.name)}</div>
            <div class="schedule-item-cron">
                <span class="schedule-cron-field">
                    <span>Minute:</span> ${schedule.cron_minute}
                </span>
                <span class="schedule-cron-field">
                    <span>Hour:</span> ${schedule.cron_hour}
                </span>
                <span class="schedule-cron-field">
                    <span>Day(Month):</span> ${schedule.cron_day_of_month}
                </span>
                <span class="schedule-cron-field">
                    <span>Month:</span> ${schedule.cron_month}
                </span>
                <span class="schedule-cron-field">
                    <span>Day(Week):</span> ${schedule.cron_day_of_week}
                </span>
            </div>
        `;

        // Click on info to edit
        info.addEventListener('click', () => this.openEditModal(schedule));

        // Actions
        const actions = document.createElement('div');
        actions.className = 'schedule-item-actions';

        // Toggle switch
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'schedule-toggle';
        toggleLabel.innerHTML = `
            <input type="checkbox" ${schedule.enabled ? 'checked' : ''}>
            <span class="schedule-toggle-slider"></span>
        `;
        const toggleInput = toggleLabel.querySelector('input');
        toggleInput.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleSchedule(schedule.id, schedule.enabled);
        });

        // Play button (manual execution)
        const playBtn = document.createElement('button');
        playBtn.className = 'schedule-action-btn schedule-action-play';
        playBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        playBtn.title = 'Execute now';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.executeSchedule(schedule.id, schedule.name);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'schedule-action-btn schedule-action-delete';
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        `;
        deleteBtn.title = 'Delete schedule';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteSchedule(schedule.id, schedule.name);
        });

        actions.appendChild(toggleLabel);
        actions.appendChild(playBtn);
        actions.appendChild(deleteBtn);

        // Assemble item
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(actions);

        return item;
    },

    /**
     * Render loading state
     */
    renderLoading() {
        const container = document.getElementById('scheduleListContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="schedule-list-loading">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
                </svg>
                <p>Loading schedules...</p>
            </div>
        `;
    },

    /**
     * Render empty state
     */
    renderEmpty() {
        const container = document.getElementById('scheduleListContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="schedule-list-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <div class="schedule-list-empty-title">No schedules yet</div>
                <div class="schedule-list-empty-description">Create your first schedule to automate server tasks</div>
            </div>
        `;
    },

    /**
     * Open create modal
     */
    openCreateModal() {
        this.state.currentEditingSchedule = null;
        if (window.ScheduleModals) {
            window.ScheduleModals.openCreateModal();
        }
    },

    /**
     * Open edit modal
     */
    openEditModal(schedule) {
        this.state.currentEditingSchedule = schedule;
        if (window.ScheduleModals) {
            window.ScheduleModals.openEditModal(schedule);
        }
    },

    /**
     * Create schedule
     */
    async createSchedule(formData) {
        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/create`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (data.success) {
                console.log('Schedule created successfully');
                this.showSuccess('Schedule created successfully');
                
                // Reload schedules
                await this.loadSchedules();
                
                return true;
            } else {
                this.showError(data.error || 'Failed to create schedule');
                return false;
            }
        } catch (error) {
            console.error('Failed to create schedule:', error);
            this.showError('Failed to create schedule');
            return false;
        }
    },

    /**
     * Update schedule
     */
    async updateSchedule(scheduleId, formData) {
        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/${scheduleId}/update`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (data.success) {
                console.log('Schedule updated successfully');
                this.showSuccess('Schedule updated successfully');
                
                // Reload schedules
                await this.loadSchedules();
                
                return true;
            } else {
                this.showError(data.error || 'Failed to update schedule');
                return false;
            }
        } catch (error) {
            console.error('Failed to update schedule:', error);
            this.showError('Failed to update schedule');
            return false;
        }
    },

    /**
     * Delete schedule
     */
    async deleteSchedule(scheduleId, scheduleName) {
        if (!confirm(`Are you sure you want to delete schedule "${scheduleName}"?`)) {
            return;
        }

        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/${scheduleId}/delete`,
                {
                    method: 'DELETE'
                }
            );

            const data = await response.json();

            if (data.success) {
                console.log('Schedule deleted successfully');
                this.showSuccess('Schedule deleted successfully');
                
                // Reload schedules
                await this.loadSchedules();
            } else {
                this.showError(data.error || 'Failed to delete schedule');
            }
        } catch (error) {
            console.error('Failed to delete schedule:', error);
            this.showError('Failed to delete schedule');
        }
    },

    /**
     * Toggle schedule enabled/disabled
     */
    async toggleSchedule(scheduleId, currentEnabled) {
        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/${scheduleId}/toggle`,
                {
                    method: 'POST'
                }
            );

            const data = await response.json();

            if (data.success) {
                console.log('Schedule toggled successfully');
                const newStatus = data.enabled ? 'enabled' : 'disabled';
                this.showSuccess(`Schedule ${newStatus} successfully`);
                
                // Update local state
                const schedule = this.state.schedules.find(s => s.id === scheduleId);
                if (schedule) {
                    schedule.enabled = data.enabled;
                }
            } else {
                this.showError(data.error || 'Failed to toggle schedule');
                
                // Reload to revert toggle
                await this.loadSchedules();
            }
        } catch (error) {
            console.error('Failed to toggle schedule:', error);
            this.showError('Failed to toggle schedule');
            
            // Reload to revert toggle
            await this.loadSchedules();
        }
    },

    /**
     * Execute schedule manually
     */
    async executeSchedule(scheduleId, scheduleName) {
        if (!confirm(`Execute schedule "${scheduleName}" now?`)) {
            return;
        }

        try {
            const response = await fetch(
                `/server/${this.state.serverName}/schedule/${scheduleId}/execute`,
                {
                    method: 'POST'
                }
            );

            const data = await response.json();

            if (data.success) {
                console.log('Schedule executed successfully');
                this.showSuccess('Schedule executed successfully');
            } else {
                this.showError(data.error || 'Failed to execute schedule');
            }
        } catch (error) {
            console.error('Failed to execute schedule:', error);
            this.showError('Failed to execute schedule');
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        alert('Error: ' + message);
        console.error(message);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('Success: ' + message);
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for global access
window.ScheduleManager = ScheduleManager;