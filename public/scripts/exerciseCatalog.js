/**
 * Script file for Exercise Catalog type pages
 */


function addItem(id) {
    var formType = $('#formType').val();

    if (formType === 'quickAddWorkout') {
        var duration = $('#duration').val();
        $.post('./quickAddWorkout', { item: id, duration: duration }, function () {
            window.location.href = "/workoutTracking/workoutLogs";
        });
    } else {
        $.post('./selectExercise', { item: id }, function () {
            window.location.href = "./workoutFilters";
        });
    }
}

const setup = () => {
    // Search bar event listener
    $('#searchBar').on('input', function () {
        const searchQuery = $(this).val();
        $.get('./searchExercise', { q: searchQuery }, function (data) {
            $('#exerciseResults').empty();
            data.forEach(item => {
                $('#exerciseResults').append(`

                <div class="container m-0 p-0 border-bottom d-flex align-items-center">
                    <div class="d-inline align-self-center d-flex my-auto" style="width: 40px;">
                        <button class="rounded-circle border-0 m-0 p-0 my-auto"
                            style="height: 30px; width: 30px"></button>
                    </div>

                    <div class="w-50 vstack gap-0">
                        <div class="d-inline-flex">
                            <span>
                                ${item.name}
                            </span>

                        </div>
                        <div class="d-inline text-secondary" style="font-size: 14px">
                            ${item.bodyPart}
                        </div>
                    </div>

                    <div>
                        <button onclick="addItem('${item.id}')" class="btn btn-light m-0 p-0 ms-auto"><img
                                src="/images/plus-circle.svg" alt="Add" height="30px"></button>
                    </div>
                </div>
                    `);
            });
        })
    });
}


$(document).ready(setup)