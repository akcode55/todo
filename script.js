// ===== Application State =====
class TodoApp {
    constructor() {
        this.tasks = [];
        this.filteredTasks = [];
        this.currentFilter = 'all';
        this.currentSort = 'created';
        this.sortOrder = 'desc';
        this.searchQuery = '';
        this.currentView = 'list';
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.editingTask = null;
        
        this.init();
    }

    // ===== Initialization =====
    init() {
        this.initializeElements();
        this.attachEventListeners();
        this.applyTheme();
        this.loadTasks();
        this.updateStats();
    }

    initializeElements() {
        // Form elements
        this.taskForm = document.getElementById('task-form');
        this.taskInput = document.getElementById('task-input');
        this.prioritySelect = document.getElementById('priority-select');
        this.categorySelect = document.getElementById('category-select');
        this.dueDateInput = document.getElementById('due-date');

        // Filter elements
        this.searchInput = document.getElementById('search-input');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.sortSelect = document.getElementById('sort-select');
        this.sortOrderBtn = document.getElementById('sort-order');

        // Task elements
        this.tasksList = document.getElementById('tasks-list');
        this.emptyState = document.getElementById('empty-state');
        this.selectAllCheckbox = document.getElementById('select-all');
        this.bulkCompleteBtn = document.getElementById('bulk-complete');
        this.bulkDeleteBtn = document.getElementById('bulk-delete');

        // View elements
        this.listViewBtn = document.getElementById('list-view');
        this.gridViewBtn = document.getElementById('grid-view');

        // Modal elements
        this.modal = document.getElementById('task-modal');
        this.editForm = document.getElementById('edit-task-form');
        this.closeModalBtns = document.querySelectorAll('.close-modal');

        // Other elements
        this.themeToggle = document.getElementById('theme-toggle');
        this.fab = document.getElementById('fab');
        this.notifications = document.getElementById('notifications');

        // Stats elements
        this.totalTasksSpan = document.getElementById('total-tasks');
        this.completedTasksSpan = document.getElementById('completed-tasks');
        this.pendingTasksSpan = document.getElementById('pending-tasks');
    }

    attachEventListeners() {
        // Form submission
        this.taskForm.addEventListener('submit', (e) => this.handleAddTask(e));
        this.editForm.addEventListener('submit', (e) => this.handleEditTask(e));

        // Search and filters
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
        });
        this.sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
        this.sortOrderBtn.addEventListener('click', () => this.toggleSortOrder());

        // Bulk actions
        this.selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        this.bulkCompleteBtn.addEventListener('click', () => this.handleBulkComplete());
        this.bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());

        // View toggle
        this.listViewBtn.addEventListener('click', () => this.setView('list'));
        this.gridViewBtn.addEventListener('click', () => this.setView('grid'));

        // Modal
        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Export/Import
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importData(e.target.files[0]);
                e.target.value = ''; // Reset file input
            }
        });

        // FAB
        this.fab.addEventListener('click', () => this.taskInput.focus());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // ===== Task Management =====
    async loadTasks() {
        try {
            // For now, we'll use localStorage instead of API
            const savedTasks = localStorage.getItem('todoTasks');
            this.tasks = savedTasks ? JSON.parse(savedTasks) : [];
            this.applyFiltersAndSort();
        } catch (error) {
            this.showNotification('خطأ في تحميل المهام', 'error');
        }
    }

    saveTasks() {
        try {
            localStorage.setItem('todoTasks', JSON.stringify(this.tasks));
            localStorage.setItem('todoLastSaved', new Date().toISOString());
            // Auto-backup every 10 tasks
            if (this.tasks.length % 10 === 0 && this.tasks.length > 0) {
                this.createBackup();
            }
        } catch (error) {
            this.showNotification('خطأ في حفظ البيانات', 'error');
        }
    }

    createBackup() {
        try {
            const backup = {
                tasks: this.tasks,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem('todoBackup', JSON.stringify(backup));
        } catch (error) {
            console.warn('Failed to create backup:', error);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    handleAddTask(e) {
        e.preventDefault();
        
        const title = this.taskInput.value.trim();
        if (!title) return;

        const task = {
            id: this.generateId(),
            title,
            description: '',
            priority: this.prioritySelect.value,
            category: this.categorySelect.value,
            dueDate: this.dueDateInput.value || null,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.tasks.unshift(task);
        this.saveTasks();
        this.applyFiltersAndSort();
        this.updateStats();
        
        // Reset form
        this.taskForm.reset();
        this.prioritySelect.value = 'medium';
        this.categorySelect.value = 'personal';
        
        this.showNotification('تم إضافة المهمة بنجاح', 'success');
    }

    handleEditTask(e) {
        e.preventDefault();
        
        if (!this.editingTask) return;

        const formData = new FormData(this.editForm);
        const updatedTask = {
            ...this.editingTask,
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            category: formData.get('category'),
            dueDate: formData.get('dueDate') || null,
            updatedAt: new Date().toISOString()
        };

        const index = this.tasks.findIndex(t => t.id === this.editingTask.id);
        if (index !== -1) {
            this.tasks[index] = updatedTask;
            this.saveTasks();
            this.applyFiltersAndSort();
            this.updateStats();
            this.closeModal();
            this.showNotification('تم تحديث المهمة بنجاح', 'success');
        }
    }

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.updatedAt = new Date().toISOString();
            this.saveTasks();
            this.applyFiltersAndSort();
            this.updateStats();
            
            const message = task.completed ? 'تم إكمال المهمة' : 'تم إلغاء إكمال المهمة';
            this.showNotification(message, 'success');
        }
    }

    deleteTask(taskId) {
        if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveTasks();
            this.applyFiltersAndSort();
            this.updateStats();
            this.showNotification('تم حذف المهمة', 'success');
        }
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.editingTask = task;
            this.populateEditForm(task);
            this.openModal();
        }
    }

    // ===== Filtering and Sorting =====
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFiltersAndSort();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.applyFiltersAndSort();
    }

    handleSort(sortBy) {
        this.currentSort = sortBy;
        this.applyFiltersAndSort();
    }

    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        this.sortOrderBtn.innerHTML = this.sortOrder === 'asc' 
            ? '<i class="fas fa-sort-amount-up"></i>' 
            : '<i class="fas fa-sort-amount-down"></i>';
        this.applyFiltersAndSort();
    }

    applyFiltersAndSort() {
        let filtered = [...this.tasks];

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(this.searchQuery) ||
                task.description.toLowerCase().includes(this.searchQuery)
            );
        }

        // Apply status filter
        switch (this.currentFilter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(task => 
                    !task.completed && task.dueDate && new Date(task.dueDate) < new Date()
                );
                break;
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (this.currentSort) {
                case 'priority':
                    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                    comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
                    break;
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate) - new Date(b.dueDate);
                    break;
                case 'alphabetical':
                    comparison = a.title.localeCompare(b.title, 'ar');
                    break;
                default: // created
                    comparison = new Date(b.createdAt) - new Date(a.createdAt);
            }
            
            return this.sortOrder === 'asc' ? comparison : -comparison;
        });

        this.filteredTasks = filtered;
        this.renderTasks();
    }

    // ===== Bulk Actions =====
    handleSelectAll(checked) {
        const checkboxes = this.tasksList.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
        this.updateBulkActions();
    }

    handleBulkComplete() {
        const selectedIds = this.getSelectedTaskIds();
        selectedIds.forEach(id => {
            const task = this.tasks.find(t => t.id === id);
            if (task && !task.completed) {
                task.completed = true;
                task.updatedAt = new Date().toISOString();
            }
        });
        
        this.saveTasks();
        this.applyFiltersAndSort();
        this.updateStats();
        this.showNotification(`تم إكمال ${selectedIds.length} مهمة`, 'success');
    }

    handleBulkDelete() {
        const selectedIds = this.getSelectedTaskIds();
        if (selectedIds.length && confirm(`هل أنت متأكد من حذف ${selectedIds.length} مهمة؟`)) {
            this.tasks = this.tasks.filter(t => !selectedIds.includes(t.id));
            this.saveTasks();
            this.applyFiltersAndSort();
            this.updateStats();
            this.showNotification(`تم حذف ${selectedIds.length} مهمة`, 'success');
        }
    }

    getSelectedTaskIds() {
        const checkboxes = this.tasksList.querySelectorAll('.task-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.dataset.taskId);
    }

    updateBulkActions() {
        const selectedCount = this.getSelectedTaskIds().length;
        this.bulkCompleteBtn.disabled = selectedCount === 0;
        this.bulkDeleteBtn.disabled = selectedCount === 0;
        
        // Update select all checkbox state
        const totalVisible = this.tasksList.querySelectorAll('.task-checkbox').length;
        this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalVisible;
        this.selectAllCheckbox.checked = selectedCount === totalVisible && totalVisible > 0;
    }

    // ===== View Management =====
    setView(view) {
        this.currentView = view;
        this.listViewBtn.classList.toggle('active', view === 'list');
        this.gridViewBtn.classList.toggle('active', view === 'grid');
        this.tasksList.classList.toggle('grid-view', view === 'grid');
        localStorage.setItem('todoView', view);
    }

    // ===== Modal Management =====
    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.editingTask = null;
        this.editForm.reset();
    }

    populateEditForm(task) {
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-priority').value = task.priority;
        document.getElementById('edit-category').value = task.category;
        document.getElementById('edit-due-date').value = task.dueDate || '';
    }

    // ===== Theme Management =====
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        
        const icon = this.themeToggle.querySelector('i');
        icon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // ===== Rendering =====
    renderTasks() {
        if (this.filteredTasks.length === 0) {
            this.tasksList.style.display = 'none';
            this.emptyState.style.display = 'block';
            return;
        }

        this.tasksList.style.display = 'flex';
        this.emptyState.style.display = 'none';
        
        this.tasksList.innerHTML = this.filteredTasks.map(task => this.createTaskHTML(task)).join('');
        
        // Attach event listeners to new elements
        this.attachTaskEventListeners();
        this.updateBulkActions();
    }

    createTaskHTML(task) {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
        const priorityClass = `priority-${task.priority}`;
        const overdueClass = isOverdue ? 'overdue' : '';
        
        return `
            <li class="task-item ${task.completed ? 'completed' : ''} ${priorityClass} ${overdueClass}">
                <div class="task-content">
                    <input type="checkbox" class="task-checkbox" 
                           data-task-id="${task.id}" 
                           ${task.completed ? 'checked' : ''}>
                    
                    <div class="task-details">
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                        
                        <div class="task-meta">
                            <span class="task-tag priority-tag ${task.priority}">
                                <i class="fas fa-flag"></i>
                                ${this.getPriorityText(task.priority)}
                            </span>
                            
                            <span class="task-tag category-tag">
                                <i class="fas ${this.getCategoryIcon(task.category)}"></i>
                                ${this.getCategoryText(task.category)}
                            </span>
                            
                            ${task.dueDate ? `
                                <span class="task-tag due-date-tag ${isOverdue ? 'overdue' : ''}">
                                    <i class="fas fa-calendar"></i>
                                    ${this.formatDate(task.dueDate)}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="task-actions">
                        <button class="task-btn edit" data-task-id="${task.id}" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="task-btn delete" data-task-id="${task.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </li>
        `;
    }

    attachTaskEventListeners() {
        // Checkbox listeners
        this.tasksList.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleTaskComplete(e.target.dataset.taskId);
                this.updateBulkActions();
            });
        });

        // Edit button listeners
        this.tasksList.querySelectorAll('.task-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editTask(e.target.closest('.task-btn').dataset.taskId);
            });
        });

        // Delete button listeners
        this.tasksList.querySelectorAll('.task-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteTask(e.target.closest('.task-btn').dataset.taskId);
            });
        });

        // Task checkbox listeners for bulk actions
        this.tasksList.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateBulkActions());
        });
    }

    // ===== Statistics =====
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = this.tasks.filter(t => 
            !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
        ).length;

        // Update numbers
        this.totalTasksSpan.textContent = total;
        this.completedTasksSpan.textContent = completed;
        this.pendingTasksSpan.textContent = pending;
        document.getElementById('overdue-tasks').textContent = overdue;

        // Update progress bars
        const maxTasks = Math.max(total, 1); // Avoid division by zero
        
        document.getElementById('total-progress').style.width = '100%';
        document.getElementById('completed-progress').style.width = `${(completed / maxTasks) * 100}%`;
        document.getElementById('pending-progress').style.width = `${(pending / maxTasks) * 100}%`;
        document.getElementById('overdue-progress').style.width = `${(overdue / maxTasks) * 100}%`;

        // Update page title with stats
        document.title = `قائمة المهام (${pending} معلقة من ${total})`;
    }

    // ===== Notifications =====
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        this.notifications.appendChild(notification);
        
        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOutLeft 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // ===== Keyboard Shortcuts =====
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to add task
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (document.activeElement === this.taskInput) {
                this.taskForm.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to close modal
        if (e.key === 'Escape' && this.modal.classList.contains('active')) {
            this.closeModal();
        }
        
        // Ctrl/Cmd + F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.searchInput.focus();
        }
    }

    // ===== Data Export/Import =====
    exportData() {
        try {
            const data = {
                tasks: this.tasks,
                exportDate: new Date().toISOString(),
                version: '1.0',
                appName: 'قائمة المهام المتقدمة'
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `todo-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('تم تصدير البيانات بنجاح', 'success');
        } catch (error) {
            this.showNotification('خطأ في تصدير البيانات', 'error');
        }
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.tasks && Array.isArray(data.tasks)) {
                    if (confirm('هل تريد استبدال المهام الحالية بالمهام المستوردة؟')) {
                        this.tasks = data.tasks;
                        this.saveTasks();
                        this.applyFiltersAndSort();
                        this.updateStats();
                        this.showNotification(`تم استيراد ${data.tasks.length} مهمة`, 'success');
                    }
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                this.showNotification('خطأ في قراءة الملف', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ===== Utility Functions =====
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getPriorityText(priority) {
        const priorities = {
            low: 'منخفضة',
            medium: 'متوسطة',
            high: 'عالية',
            urgent: 'عاجلة'
        };
        return priorities[priority] || priority;
    }

    getCategoryText(category) {
        const categories = {
            personal: 'شخصي',
            work: 'عمل',
            shopping: 'تسوق',
            health: 'صحة',
            education: 'تعليم',
            other: 'أخرى'
        };
        return categories[category] || category;
    }

    getCategoryIcon(category) {
        const icons = {
            personal: 'fa-user',
            work: 'fa-briefcase',
            shopping: 'fa-shopping-cart',
            health: 'fa-heartbeat',
            education: 'fa-graduation-cap',
            other: 'fa-tag'
        };
        return icons[category] || 'fa-tag';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'اليوم';
        if (diffDays === 1) return 'غداً';
        if (diffDays === -1) return 'أمس';
        if (diffDays < 0) return `متأخر ${Math.abs(diffDays)} يوم`;
        if (diffDays <= 7) return `خلال ${diffDays} أيام`;
        
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// ===== Initialize Application =====
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});

// ===== Service Worker Registration =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
