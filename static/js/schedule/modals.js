/* ========================================
   MODALS.JS - Schedule Modals Handling
   ======================================== */

const ScheduleModals = {
    state: {
        isOpen: false,
        mode: 'create', // 'create' or 'edit'
        currentScheduleId: null
    },

    /**
     * Initialize modals
     */
    init() {
        this.initEventListeners();
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Close button
        const closeBtn = document.getElementById('closeScheduleModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelScheduleBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Click outside to close
        const modal = document.getElementById('scheduleModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isOpen) {
                this.closeModal();
            }
        });

        // Form submission
        const form = document.getElementById('scheduleForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        // Action dropdown change - show/hide command input
        const actionSelect = document.getElementById('scheduleAction');
        if (actionSelect) {
            actionSelect.addEventListener('change', (e) => {
                this.handleActionChange(e.target.value);
            });
        }

        // Toggle label update
        const toggleInput = document.getElementById('scheduleEnabled');
        if (toggleInput) {
            toggleInput.addEventListener('change', (e) => {
                const label = document.getElementById('scheduleEnabledLabel');
                if (label) {
                    label.textContent = e.target.checked ? 'Enabled' : 'Disabled';
                }
            });
        }
    },

    /**
     * Open create modal
     */
    openCreateModal() {
        this.state.mode = 'create';
        this.state.currentScheduleId = null;

        // Reset form
        this.resetForm();

        // Update modal title and button
        const title = document.getElementById('scheduleModalTitle');
        const submitBtn = document.getElementById('submitScheduleBtn');

        if (title) title.textContent = 'Create new schedule';
        if (submitBtn) submitBtn.textContent = 'Create Schedule';

        // Show modal
        this.showModal();

        // Focus name input
        setTimeout(() => {
            const nameInput = document.getElementById('scheduleName');
            if (nameInput) nameInput.focus();
        }, 100);
    },

    /**
     * Open edit modal with schedule data
     */
    openEditModal(schedule) {
        this.state.mode = 'edit';
        this.state.currentScheduleId = schedule.id;

        // Reset form first
        this.resetForm();

        // Populate form with schedule data
        this.populateForm(schedule);

        // Update modal title and button
        const title = document.getElementById('scheduleModalTitle');
        const submitBtn = document.getElementById('submitScheduleBtn');

        if (title) title.textContent = 'Edit schedule';
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        // Show modal
        this.showModal();
    },

    /**
     * Populate form with schedule data
     */
    populateForm(schedule) {
        // Name
        const nameInput = document.getElementById('scheduleName');
        if (nameInput) nameInput.value = schedule.name || '';

        // Cron fields
        const cronMinute = document.getElementById('cronMinute');
        const cronHour = document.getElementById('cronHour');
        const cronDayOfMonth = document.getElementById('cronDayOfMonth');
        const cronMonth = document.getElementById('cronMonth');
        const cronDayOfWeek = document.getElementById('cronDayOfWeek');

        if (cronMinute) cronMinute.value = schedule.cron_minute || '*';
        if (cronHour) cronHour.value = schedule.cron_hour || '*';
        if (cronDayOfMonth) cronDayOfMonth.value = schedule.cron_day_of_month || '*';
        if (cronMonth) cronMonth.value = schedule.cron_month || '*';
        if (cronDayOfWeek) cronDayOfWeek.value = schedule.cron_day_of_week || '*';

        // Enabled toggle
        const enabledInput = document.getElementById('scheduleEnabled');
        const enabledLabel = document.getElementById('scheduleEnabledLabel');
        if (enabledInput) {
            enabledInput.checked = schedule.enabled;
        }
        if (enabledLabel) {
            enabledLabel.textContent = schedule.enabled ? 'Enabled' : 'Disabled';
        }

        // Action
        const actionSelect = document.getElementById('scheduleAction');
        if (actionSelect) {
            actionSelect.value = schedule.action || 'send_command';
            // Trigger change to show/hide command input
            this.handleActionChange(actionSelect.value);
        }

        // Command
        const commandInput = document.getElementById('scheduleCommand');
        if (commandInput) {
            commandInput.value = schedule.command || '';
        }
    },

    /**
     * Reset form to defaults
     */
    resetForm() {
        const form = document.getElementById('scheduleForm');
        if (form) form.reset();

        // Reset cron fields to *
        ['cronMinute', 'cronHour', 'cronDayOfMonth', 'cronMonth', 'cronDayOfWeek'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '*';
        });

        // Reset toggle label
        const enabledLabel = document.getElementById('scheduleEnabledLabel');
        if (enabledLabel) enabledLabel.textContent = 'Enabled';

        // Reset enabled to checked
        const enabledInput = document.getElementById('scheduleEnabled');
        if (enabledInput) enabledInput.checked = true;

        // Show command group (default action is send_command)
        this.handleActionChange('send_command');

        // Reset action to send_command
        const actionSelect = document.getElementById('scheduleAction');
        if (actionSelect) actionSelect.value = 'send_command';
    },

    /**
     * Handle action dropdown change - show/hide command input
     */
    handleActionChange(action) {
        const commandGroup = document.getElementById('commandGroup');
        if (!commandGroup) return;

        if (action === 'send_command') {
            commandGroup.style.display = 'block';

            // Make command required
            const commandInput = document.getElementById('scheduleCommand');
            if (commandInput) commandInput.required = true;
        } else {
            commandGroup.style.display = 'none';

            // Remove required from command
            const commandInput = document.getElementById('scheduleCommand');
            if (commandInput) {
                commandInput.required = false;
                commandInput.value = '';
            }
        }
    },

    /**
     * Handle form submission
     */
    async handleSubmit() {
        const submitBtn = document.getElementById('submitScheduleBtn');

        // Validate form
        if (!this.validateForm()) return;

        // Disable submit button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = this.state.mode === 'create' ? 'Creating...' : 'Saving...';
        }

        // Build form data
        const formData = this.buildFormData();

        let success = false;

        if (this.state.mode === 'create') {
            success = await window.ScheduleManager.createSchedule(formData);
        } else {
            success = await window.ScheduleManager.updateSchedule(
                this.state.currentScheduleId,
                formData
            );
        }

        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = this.state.mode === 'create' ? 'Create Schedule' : 'Save Changes';
        }

        // Close modal on success
        if (success) {
            this.closeModal();
        }
    },

    /**
     * Build form data for submission
     */
    buildFormData() {
        const formData = new URLSearchParams();

        // Name
        const name = document.getElementById('scheduleName')?.value?.trim() || '';
        formData.append('name', name);

        // Cron fields
        formData.append('cron_minute', document.getElementById('cronMinute')?.value?.trim() || '*');
        formData.append('cron_hour', document.getElementById('cronHour')?.value?.trim() || '*');
        formData.append('cron_day_of_month', document.getElementById('cronDayOfMonth')?.value?.trim() || '*');
        formData.append('cron_month', document.getElementById('cronMonth')?.value?.trim() || '*');
        formData.append('cron_day_of_week', document.getElementById('cronDayOfWeek')?.value?.trim() || '*');

        // Enabled
        const enabled = document.getElementById('scheduleEnabled')?.checked ? 'true' : 'false';
        formData.append('enabled', enabled);

        // Action
        const action = document.getElementById('scheduleAction')?.value || 'send_command';
        formData.append('action', action);

        // Command (only for send_command)
        if (action === 'send_command') {
            const command = document.getElementById('scheduleCommand')?.value?.trim() || '';
            formData.append('command', command);
        }

        return formData;
    },

    /**
     * Validate form before submission
     */
    validateForm() {
        // Validate name
        const name = document.getElementById('scheduleName')?.value?.trim();
        if (!name) {
            alert('Schedule name is required');
            document.getElementById('scheduleName')?.focus();
            return false;
        }

        // Validate cron fields
        const cronFields = [
            { id: 'cronMinute', label: 'Minute', min: 0, max: 59 },
            { id: 'cronHour', label: 'Hour', min: 0, max: 23 },
            { id: 'cronDayOfMonth', label: 'Day of Month', min: 1, max: 31 },
            { id: 'cronMonth', label: 'Month', min: 1, max: 12 },
            { id: 'cronDayOfWeek', label: 'Day of Week', min: 0, max: 6 }
        ];

        for (const field of cronFields) {
            const input = document.getElementById(field.id);
            const value = input?.value?.trim();

            if (!value) {
                alert(`${field.label} cron field is required`);
                input?.focus();
                return false;
            }
        }

        // Validate command if action is send_command
        const action = document.getElementById('scheduleAction')?.value;
        if (action === 'send_command') {
            const command = document.getElementById('scheduleCommand')?.value?.trim();
            if (!command) {
                alert('Command is required for Send Commands action');
                document.getElementById('scheduleCommand')?.focus();
                return false;
            }
        }

        return true;
    },

    /**
     * Show modal
     */
    showModal() {
        const modal = document.getElementById('scheduleModal');
        if (!modal) return;

        modal.classList.add('show');
        this.state.isOpen = true;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    },

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('scheduleModal');
        if (!modal) return;

        modal.classList.remove('show');
        this.state.isOpen = false;
        this.state.currentScheduleId = null;
        this.state.mode = 'create';

        // Restore body scroll
        document.body.style.overflow = '';
    }
};

// Export for global access
window.ScheduleModals = ScheduleModals;