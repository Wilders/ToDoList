/***********************************************************************************
 * App Services. This contains the logic of the application organised in modules/objects. *
 ***********************************************************************************/

myApp.services = {

    /////////////////
    // Task Service //
    /////////////////
    tasks: {

        // Creates a new task and attaches it to the pending task list.
        create: function (data) {
            let isOutdated = (Date.parse(data.deadline) < new Date().getTime()) ? '&#8987' : '';


            // Task item template.
            var taskItem = ons.createElement(
                `<ons-list-item tappable ${isOutdated !== "" ? "status=outdated" : ""} component="task" category="' + myApp.services.categories.parseId(data.category) + '">` +
                '<label class="left">' +
                '<ons-checkbox></ons-checkbox>' +
                '</label>' +
                '<div class="center">' +
                data.title +
                '</div>' +
                '<div class="right">' +
                '   <ons-icon style="color: grey; padding-left: 4px" icon="ion-ios-trash-outline, material:md-delete"></ons-icon>' +
                '</div>' +
                '</ons-list-item>'
            );

            //Add the data in the LocalStorage
            addInStorage(data);

            // Store data within the element.
            taskItem.data = data;

            // Add 'completion' functionality when the checkbox changes.
            taskItem.data.onCheckboxChange = function (event) {
                myApp.services.animators.swipe(taskItem, function () {
                    let listId = '#pending-list';
                    let newStatus = 'pending';
                    if (taskItem.parentElement.id === 'pending-list' && event.target.checked) {
                        listId = '#progress-list';
                        newStatus = 'progress';
                        event.target.checked = false;
                    }
                    if (taskItem.parentElement.id === 'progress-list' && event.target.checked) {
                        listId = "#completed-list";
                        newStatus = 'completed';
                    }

                    //var listId = (taskItem.parentElement.id === 'pending-list' && event.target.checked) ? '#completed-list' : '#pending-list';
                    document.querySelector(listId).appendChild(taskItem);

                    //update local storage
                    let newData = {
                        title: data.title,
                        category: data.category,
                        description: data.description,
                        urgent: data.urgent,
                        highlight: data.highlight,
                        status: newStatus,
                        deadline: data.deadline,
                        sortIndex: data.sortIndex
                    };
                    update(newData);

                });
            };

            taskItem.addEventListener('change', taskItem.data.onCheckboxChange);

            // Add button functionality to remove a task.
            taskItem.querySelector('.right').onclick = function () {
                myApp.services.tasks.remove(taskItem);
            };

            // Add functionality to push 'details_task.html' page with the current element as a parameter.
            taskItem.querySelector('.center').onclick = function () {
                document.querySelector('#myNavigator')
                    .pushPage('html/details_task.html',
                        {
                            animation: 'lift',
                            data: {
                                element: taskItem
                            }
                        }
                    );
            };

            // Check if it's necessary to create new categories for this item.
            myApp.services.categories.updateAdd(taskItem.data.category);

            // Add the highlight if necessary.
            if (taskItem.data.highlight) {
                taskItem.classList.add('highlight');
            }

            // Insert urgent tasks at the top and non urgent tasks at the bottom.
            let pendingList = document.querySelector('#' + data.status + '-list');
            pendingList.appendChild(taskItem);
        },

        // Modifies the inner data and current view of an existing task.
        update: function (taskItem, data) {
            if (data.title !== taskItem.data.title) {
                // Update title view.
                taskItem.querySelector('.center').innerHTML = data.title;
            }

            if (data.category !== taskItem.data.category) {
                // Modify the item before updating categories.
                taskItem.setAttribute('category', myApp.services.categories.parseId(data.category));
                // Check if it's necessary to create new categories.
                myApp.services.categories.updateAdd(data.category);
                // Check if it's necessary to remove empty categories.
                myApp.services.categories.updateRemove(taskItem.data.category);

            }

            // Add or remove the highlight.
            taskItem.classList[data.highlight ? 'add' : 'remove']('highlight');

            // Store the new data within the element.
            taskItem.data = data;
            addInStorage(data);
        },

        // Deletes a task item and its listeners.
        remove: function (taskItem) {
            taskItem.removeEventListener('change', taskItem.data.onCheckboxChange);

            myApp.services.animators.remove(taskItem, function () {
                // Remove the item before updating the categories.
                taskItem.remove();
                // Check if the category has no items and remove it in that case.
                myApp.services.categories.updateRemove(taskItem.data.category);
            });
            removeInStorage(taskItem);
        },

        removeAll: function () {
            let tasks = document.querySelectorAll('[component="task"]');
            tasks.forEach((task) => myApp.services.tasks.remove(task));
        },

        removeAllOutdated: function () {
            let tasks = document.querySelectorAll('[component="task"]');
            tasks.forEach((task) => {
                if ($(task).attr('status') === 'outdated')
                    myApp.services.tasks.remove(task);
            })
        },

        sort: function (choice) {
            let change = (res, a, b) => {
                if (res === 1 && a.sortIndex < b.sortIndex || res === -1 && a.sortIndex > b.sortIndex) {
                    let tmp = a.sortIndex;
                    a.sortIndex = b.sortIndex;
                    b.sortIndex = tmp;
                }
            };

            let tasks = getAllTasks();
            let testFunc;

            switch (choice) {
                case 'alpha_asc' : {
                    testFunc = (a, b) => {
                        let res = a.title.localeCompare(b.title);
                        change(res, a, b);
                        return res;
                    };
                    break;
                }

                case 'alpha_desc' : {
                    testFunc = (a, b) => {
                        let res = -a.title.localeCompare(b.title);
                        change(res, a, b);
                        return res;
                    };
                    break;
                }

                case 'date_asc' : {
                    testFunc = (a, b) => {
                        let res = Date.parse(a.deadline) < Date.parse(b.deadline) ? 1 : -1;
                        changeTaskSortIndex(res, a, b);
                        return res;
                    };
                    break;
                }

                case 'date_desc' : {
                    testFunc = (a, b) => {
                        let res = Date.parse(a.deadline) < Date.parse(b.deadline) ? -1 : 1;
                        change(res, a, b);
                        return res;
                    };
                    break;
                }
            }

            tasks.sort(testFunc);
            this.removeAll();
            tasks.forEach((task) => this.create(task));
        }
    },

    /////////////////////
    // Category Service //
    ////////////////////
    categories: {

        categories: [],

        // Creates a new category and attaches it to the custom category list.
        create: function (categoryLabel) {
            if (!this.categories.includes(categoryLabel)) {
                this.categories.push(categoryLabel);

                var categoryId = myApp.services.categories.parseId(categoryLabel);

                // Category item template.
                var categoryItem = ons.createElement(
                    '<ons-list-item tappable category-id="' + categoryId + '">' +
                    '<div class="left">' +
                    '<ons-radio name="categoryGroup" input-id="radio-' + categoryId + '"></ons-radio>' +
                    '</div>' +
                    '<label class="center" for="radio-' + categoryId + '">' +
                    (categoryLabel || 'No category') +
                    '</label>' +
                    '<div class="right">' +
                    '<ons-icon style="color: grey; padding-left: 4px" icon="ion-ios-trash-outline, material:md-delete"></ons-icon>' +
                    '</div>' +
                    '</ons-list-item>'
                );

                categoryItem.querySelector('.right').onclick = function () {
                    let tasks = document.querySelectorAll('[component="task"]');
                    tasks.forEach((task) => {
                        if ($(task).attr('category') === categoryId)
                            myApp.services.tasks.remove(task);
                    })
                };

                // Adds filtering functionality to this category item.
                myApp.services.categories.bindOnCheckboxChange(categoryItem);

                // Attach the new category to the corresponding list.
                document.querySelector('#custom-category-list').appendChild(categoryItem);
            }
        },


        // On task creation/update, updates the category list adding new categories if needed.
        updateAdd: function (categoryLabel) {
            var categoryId = myApp.services.categories.parseId(categoryLabel);
            var categoryItem = document.querySelector('#menuPage ons-list-item[category-id="' + categoryId + '"]');

            if (!categoryItem) {
                // If the category doesn't exist already, create it.
                myApp.services.categories.create(categoryLabel);
            }
        },

        // On task deletion/update, updates the category list removing categories without tasks if needed.
        updateRemove: function (categoryLabel) {
            var categoryId = myApp.services.categories.parseId(categoryLabel);
            var categoryItem = document.querySelector('#tabbarPage ons-list-item[category="' + categoryId + '"]');

            if (!categoryItem) {
                // If there are no tasks under this category, remove it.
                myApp.services.categories.remove(document.querySelector('#custom-category-list ons-list-item[category-id="' + categoryId + '"]'));
            }
        },

        // Deletes a category item and its listeners.
        remove: function (categoryItem) {
            if (categoryItem) {
                // Remove listeners and the item itself.
                categoryItem.removeEventListener('change', categoryItem.updateCategoryView);
                categoryItem.remove();
            }
        },

        // Adds filtering functionality to a category item.
        bindOnCheckboxChange: function (categoryItem) {
            var categoryId = categoryItem.getAttribute('category-id');
            var allItems = categoryId === null;

            categoryItem.updateCategoryView = function () {
                var taskItems = document.querySelectorAll('#tabbarPage ons-list-item');
                for (var i = 0; i < taskItems.length; i++) {
                    taskItems[i].style.display = (allItems || taskItems[i].getAttribute('category') === categoryId) ? '' : 'none';
                }
            };

            categoryItem.addEventListener('change', categoryItem.updateCategoryView);
        },

        // Transforms a category name into a valid id.
        parseId: function (categoryLabel) {
            return categoryLabel ? categoryLabel.replace(/\s\s+/g, ' ').toLowerCase() : '';
        }
    },

    //////////////////////
    // Animation Service //
    /////////////////////
    animators: {

        // Swipe animation for task completion.
        swipe: function (listItem, callback) {
            var animation = (listItem.parentElement.id === 'pending-list') ? 'animation-swipe-right' : 'animation-swipe-left';
            listItem.classList.add('hide-children');
            listItem.classList.add(animation);

            setTimeout(function () {
                listItem.classList.remove(animation);
                listItem.classList.remove('hide-children');
                callback();
            }, 950);
        },

        // Remove animation for task deletion.
        remove: function (listItem, callback) {
            listItem.classList.add('animation-remove');
            listItem.classList.add('hide-children');

            setTimeout(function () {
                callback();
            }, 750);
        }
    },

    ////////////////////////
    // Initial Data Service //
    ////////////////////////
    defaultData: [
        {
            title: 'Test !',
            category: 'Cat1',
            description: 'description 1',
            highlight: false,
            urgent: true,
            status: "pending",
            deadline: '2000-04-08',
        },
        {
            title: 'Rendu intermédiaire',
            category: 'Cat1',
            description: 'description 2',
            highlight: false,
            urgent: false,
            status: "pending",
            deadline: '2020-04-10'
        }
    ]
};
