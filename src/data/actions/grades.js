import {
  STARTED_FETCHING_GRADES,
  FINISHED_FETCHING_GRADES,
  ERROR_FETCHING_GRADES,
  GOT_GRADES,
  GRADE_UPDATE_REQUEST,
  GRADE_UPDATE_SUCCESS,
  GRADE_UPDATE_FAILURE,
  TOGGLE_GRADE_FORMAT,
  FILTER_BY_ASSIGNMENT_TYPE,
  OPEN_BANNER,
  CLOSE_BANNER,
  START_UPLOAD,
  UPLOAD_COMPLETE,
  UPLOAD_ERR,
  GOT_BULK_HISTORY,
  BULK_HISTORY_ERR,
  GOT_GRADE_OVERRIDE_HISTORY,
  ERROR_FETCHING_GRADE_OVERRIDE_HISTORY,
} from '../constants/actionTypes/grades';
import LmsApiService from '../services/LmsApiService';
import { sortAlphaAsc, formatDateForDisplay } from './utils';
import { formatMaxAssignmentGrade, formatMinAssignmentGrade, formatMaxCourseGrade, formatMinCourseGrade } from '../selectors/grades';
import { getFilters } from '../selectors/filters';
import apiClient from '../apiClient';

const defaultAssignmentFilter = 'All';

const startedCsvUpload = () => ({ type: START_UPLOAD });
const finishedCsvUpload = () => ({ type: UPLOAD_COMPLETE });
const csvUploadError = data => ({ type: UPLOAD_ERR, data });
const gotBulkHistory = data => ({ type: GOT_BULK_HISTORY, data });
const bulkHistoryError = () => ({ type: BULK_HISTORY_ERR });

const startedFetchingGrades = () => ({ type: STARTED_FETCHING_GRADES });
const finishedFetchingGrades = () => ({ type: FINISHED_FETCHING_GRADES });
const errorFetchingGrades = () => ({ type: ERROR_FETCHING_GRADES });
const errorFetchingGradeOverrideHistory = () => ({ type: ERROR_FETCHING_GRADE_OVERRIDE_HISTORY });

const gotGrades = ({
  grades, cohort, track, assignmentType, headings, prev,
  next, courseId, totalUsersCount, filteredUsersCount,
}) => ({
  type: GOT_GRADES,
  grades,
  cohort,
  track,
  assignmentType,
  headings,
  prev,
  next,
  courseId,
  totalUsersCount,
  filteredUsersCount,
});

const gotGradeOverrideHistory = ({
  overrideHistory, currentEarnedAllOverride, currentPossibleAllOverride,
  currentEarnedGradedOverride, currentPossibleGradedOverride,
  originalGradeEarnedAll, originalGradePossibleAll, originalGradeEarnedGraded,
  originalGradePossibleGraded,
}) => ({
  type: GOT_GRADE_OVERRIDE_HISTORY,
  overrideHistory,
  currentEarnedAllOverride,
  currentPossibleAllOverride,
  currentEarnedGradedOverride,
  currentPossibleGradedOverride,
  originalGradeEarnedAll,
  originalGradePossibleAll,
  originalGradeEarnedGraded,
  originalGradePossibleGraded,
});

const gradeUpdateRequest = () => ({ type: GRADE_UPDATE_REQUEST });
const gradeUpdateSuccess = (courseId, responseData) => ({
  type: GRADE_UPDATE_SUCCESS,
  courseId,
  payload: { responseData },
});
const gradeUpdateFailure = (courseId, error) => ({
  type: GRADE_UPDATE_FAILURE,
  courseId,
  payload: { error },
});


const toggleGradeFormat = formatType => ({ type: TOGGLE_GRADE_FORMAT, formatType });

const filterAssignmentType = filterType => (
  dispatch => dispatch({
    type: FILTER_BY_ASSIGNMENT_TYPE,
    filterType,
  })
);

const openBanner = () => ({ type: OPEN_BANNER });
const closeBanner = () => ({ type: CLOSE_BANNER });

const fetchGrades = (
  courseId,
  cohort,
  track,
  assignmentType,
  options = {},
) => (
  (dispatch, getState) => {
    dispatch(startedFetchingGrades());
    const {
      assignment,
      assignmentGradeMax: assignmentMax,
      assignmentGradeMin: assignmentMin,
      courseGradeMin,
      courseGradeMax,
    } = getFilters(getState());
    const { id: assignmentId } = assignment || {};
    const assignmentGradeMax = formatMaxAssignmentGrade(assignmentMax, { assignmentId });
    const assignmentGradeMin = formatMinAssignmentGrade(assignmentMin, { assignmentId });
    const courseGradeMinFormatted = formatMinCourseGrade(courseGradeMin);
    const courseGradeMaxFormatted = formatMaxCourseGrade(courseGradeMax);
    return LmsApiService.fetchGradebookData(
      courseId,
      options.searchText || null,
      cohort,
      track,
      {
        assignment: assignmentId,
        assignmentGradeMax,
        assignmentGradeMin,
        courseGradeMin: courseGradeMinFormatted,
        courseGradeMax: courseGradeMaxFormatted,
      },

    )
      .then(response => response.data)
      .then((data) => {
        dispatch(gotGrades({
          grades: data.results.sort(sortAlphaAsc),
          cohort,
          track,
          assignmentType,
          prev: data.previous,
          next: data.next,
          courseId,
          totalUsersCount: data.total_users_count,
          filteredUsersCount: data.filtered_users_count,
        }));
        dispatch(finishedFetchingGrades());
        if (options.showSuccess) {
          dispatch(openBanner());
        }
      })
      .catch(() => {
        dispatch(errorFetchingGrades());
      });
  }
);

const formatGradeOverrideForDisplay = historyArray => historyArray.map(item => ({
  date: formatDateForDisplay(new Date(item.history_date)),
  grader: item.history_user,
  reason: item.override_reason,
  adjustedGrade: item.earned_graded_override,
}));

const fetchGradeOverrideHistory = (subsectionId, userId) => (
  dispatch =>
    LmsApiService.fetchGradeOverrideHistory(subsectionId, userId)
      .then(response => response.data)
      .then((data) => {
        dispatch(gotGradeOverrideHistory({
          overrideHistory: formatGradeOverrideForDisplay(data.history),
          currentEarnedAllOverride: data.override ? data.override.earned_all_override : null,
          currentPossibleAllOverride: data.override ? data.override.possible_all_override : null,
          currentEarnedGradedOverride: data.override ? data.override.earned_graded_override : null,
          currentPossibleGradedOverride: data.override ?
            data.override.possible_graded_override : null,
          originalGradeEarnedAll: data.original_grade ? data.original_grade.earned_all : null,
          originalGradePossibleAll: data.original_grade ? data.original_grade.possible_all : null,
          originalGradeEarnedGraded: data.original_grade ? data.original_grade.earned_graded : null,
          originalGradePossibleGraded: data.original_grade ?
            data.original_grade.possible_graded : null,
        }));
      })
      .catch(() => {
        dispatch(errorFetchingGradeOverrideHistory());
      })
);

const fetchMatchingUserGrades = (
  courseId,
  searchText,
  cohort,
  track,
  assignmentType,
  showSuccess,
  options = {},
) => {
  const newOptions = { ...options, searchText, showSuccess };
  return fetchGrades(courseId, cohort, track, assignmentType, newOptions);
};

const fetchPrevNextGrades = (endpoint, courseId, cohort, track, assignmentType) => (
  (dispatch) => {
    dispatch(startedFetchingGrades());
    return apiClient.get(endpoint)
      .then(response => response.data)
      .then((data) => {
        dispatch(gotGrades({
          grades: data.results.sort(sortAlphaAsc),
          cohort,
          track,
          assignmentType,
          prev: data.previous,
          next: data.next,
          courseId,
          totalUsersCount: data.total_users_count,
          filteredUsersCount: data.filtered_users_count,
        }));
        dispatch(finishedFetchingGrades());
      })
      .catch(() => {
        dispatch(errorFetchingGrades());
      });
  }
);

const updateGrades = (courseId, updateData, searchText, cohort, track) => (
  (dispatch) => {
    dispatch(gradeUpdateRequest());
    return LmsApiService.updateGradebookData(courseId, updateData)
      .then(response => response.data)
      .then((data) => {
        dispatch(gradeUpdateSuccess(courseId, data));
        dispatch(fetchMatchingUserGrades(
          courseId,
          searchText,
          cohort,
          track,
          defaultAssignmentFilter,
          true,
          { searchText },
        ));
      })
      .catch((error) => {
        dispatch(gradeUpdateFailure(courseId, error));
      });
  }
);

const submitFileUploadFormData = (courseId, formData) => (
  (dispatch) => {
    dispatch(startedCsvUpload());
    return LmsApiService.uploadGradeCsv(courseId, formData).then(() => (
      dispatch(finishedCsvUpload())
    )).catch((err) => {
      if (err.status === 200 && err.data.error_messages.length) {
        const { error_messages: errorMessages, saved, total } = err.data;
        return dispatch(csvUploadError({ errorMessages, saved, total }));
      }
      return dispatch(csvUploadError({ errorMessages: ['Unknown error.'] }));
    });
  }
);

const fetchBulkUpgradeHistory = courseId => (
  dispatch =>
    // todo add loading effect
    LmsApiService.fetchGradeBulkOperationHistory(courseId).then((response) => {
      dispatch(gotBulkHistory(response));
    }).catch(() => dispatch(bulkHistoryError()))
);

const updateGradesIfAssignmentGradeFiltersSet = (
  courseId,
  cohort,
  track,
  assignmentType,
) => (dispatch, getState) => {
  const { filters } = getState();
  const hasAssignmentGradeFiltersSet = filters.assignmentGradeMax || filters.assignmentGradeMin;
  if (hasAssignmentGradeFiltersSet) {
    dispatch(fetchGrades(
      courseId,
      cohort,
      track,
      assignmentType,
    ));
  }
};

export {
  startedFetchingGrades,
  finishedFetchingGrades,
  errorFetchingGrades,
  gotGrades,
  fetchGrades,
  fetchMatchingUserGrades,
  fetchPrevNextGrades,
  gradeUpdateRequest,
  gradeUpdateSuccess,
  gradeUpdateFailure,
  updateGrades,
  toggleGradeFormat,
  filterAssignmentType,
  closeBanner,
  submitFileUploadFormData,
  fetchBulkUpgradeHistory,
  fetchGradeOverrideHistory,
  updateGradesIfAssignmentGradeFiltersSet,
};
