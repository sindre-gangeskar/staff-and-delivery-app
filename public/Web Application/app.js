var selection = null;
var currentRowIndex;
var staffArray = [];
var staffOutArray = [[], []];
var promises = [];
var errorTimeout;
var getLateInterval;
var currentDay = 0;
var deliveryArray = [[], []];
$(document).ready(function () {
  const selectionColor = $("body").css("--table-cell-highlight-color");
  digitalClock();

  getLateInterval = setInterval(() => {
    deliveryDriverIsLate();
    staffMemberIsLate();
  }, 1000)

  for (let i = 0; i < 5; i++) {
    var promise = new Promise(function (resolve) {
      staffUserGet(function (generatedUser) {
        var newStaffUser = new StaffMember(generatedUser.firstName, generatedUser.surName, generatedUser.picture, generatedUser.email, "In", "", "", "", false);

        staffArray.push(newStaffUser);
        appendToStaffTable(newStaffUser);
        resolve();
        Promise.all(promises).then(() => {
          if (staffArray.length > 5 - 1) console.log("Staff Array: ", staffArray);
        })
      });
    });
  }

  $(".table-staff-body, .table-delivery-body").on("click", "tr", function () {
    currentRowIndex = $(this).index();
    /* If there was a previous selection, reset its color */
    if (selection) {
      selection.css({ "background-color": "" });
    }
    selection = $(this);
    selection.css({ "background-color": `${selectionColor}` });
  });
  $(".clock-out-modal-input").on("keypress", function (e) {
    if (e.keyCode === 13 && $(this).val() != "") {
      staffOut();
      validateStaffClockOut();
    }
  });

  $(".vehicle-type-selection").on("change", function () {
    getVehicleTypeSelection();
  });

  $(".add-btn").on("click", function () {
    addDelivery();
  });
  /* Add a style to the button and remove it in 1000ms */
  $("button").on("click", function () {
    self = $(this);
    self.addClass("clicked");
    setTimeout(function () {
      self.removeClass("clicked");
    }, 1000);
  });
});

/* Functions */
function digitalClock() {
  var currentTimeElement = $(".current-time");
  function updateClock() {
    var time = new Date();
    var formattedTime = time.toLocaleTimeString("en-US", { hour12: false });
    currentTimeElement.html(`Date: ${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()} Time: ${formattedTime} `);
  }
  setInterval(updateClock, 1000);
  return new Date();
}
function staffUserGet(callback) {
  $.ajax({
    url: "https://randomuser.me/api/",
    dataType: "json",
    success: function (data) {
      const generatedUser = {
        picture: data.results[0].picture.thumbnail,
        firstName: data.results[0].name.first,
        surName: data.results[0].name.last,
        email: data.results[0].email,
        status: "In",
        outTime: "",
        duration: "",
        expectedReturnTime: "",
        staffMemberIsLate: "",
      };
      callback(generatedUser);
    },
    error: function (error) {
      console.log(error);
      return;
    },
  });
}
function appendToStaffTable(user) {
  var staffListArray = [];
  const newUserDataRow = $(`
  <tr class='staff-user'>
    <td class='staff-picture'><img src="${user.info.picture}" alt="User Picture"></></td>
    <td class='staff-name'>${user.info.name}</td>
    <td class='staff-surname'>${user.info.surName}</td>
    <td class='staff-email'>${user.info.email}</td>
    <td class='staff-status'>${user.info.status}</td>
    <td class='staff-out-time'>${user.info.outTime}</td>
    <td class='staff-duration'>${user.info.duration}</td>
    <td class='staff-expected-return-time'>${user.info.expectedReturnTime}</td>
    </tr>`);

  staffListArray.push(newUserDataRow);
  $(newUserDataRow).appendTo($(".table-staff-body"));
}
function staffOut() {
  if (currentRowIndex != null && selection.hasClass("staff-user")) {
    $(".clock-out-modal-title").html(`Enter out-time for ${staffArray[currentRowIndex].info.name} ${staffArray[currentRowIndex].info.surName} in minutes `);
    $(".clock-out-modal").modal("show");
  }
}
function staffIn() {
  if (currentRowIndex != null && selection.hasClass("staff-user") && staffArray[currentRowIndex].info.status != "In") {
    selection.addClass("clocked-in-selection");
    clockInVisualConfirmation(1500);

    staffArray[currentRowIndex].status = "In";
    staffArray[currentRowIndex].outTime = "";
    staffArray[currentRowIndex].duration = "";
    staffArray[currentRowIndex].expectedReturnTime = "";
    staffArray[currentRowIndex].staffMemberIsLate = false;

    selection.find(".staff-status").html(staffArray[currentRowIndex].info.status);
    selection.find(".staff-out-time").html(staffArray[currentRowIndex].info.outTime);
    selection.find(".staff-duration").html(staffArray[currentRowIndex].info.duration);
    selection.find(".staff-expected-return-time").html(staffArray[currentRowIndex].info.expectedReturnTime);

    /* Control staff returning and remove the user from the staffOutArray, no longer being registered as out */
    const indexToRemove = staffOutArray[0].findIndex((staff) => staff.info.email === staffArray[currentRowIndex].info.email);
    if (indexToRemove != -1) {
      staffOutArray[0].splice(indexToRemove, 1);
      staffOutArray[1].splice(indexToRemove, 1);
    }
  }
}
function validateStaffClockOut() {
  /* Regex test, no starting 0 in duration accepted */
  const numberRegex = /^(?!0)[0-9]{1,4}$/;
  let value = $(".clock-out-modal-input").val();
  /* If the value is greater than 23 hours in minutes, display error and return */
  if (value > 1380) {
    displayError(3000);
    $(".clock-out-modal-input").val("");
    return;
  }
  /* Test regex for numbers only up to three digits, if success then proceed */
  if (numberRegex.test(Number(value))) {
    const time = calculateReturnAndLateTime(value);

    staffArray[currentRowIndex].staffMemberIsLate = false;
    staffArray[currentRowIndex].status = "Out";
    staffArray[currentRowIndex].outTime = { clockMonth: time.month, clockDay: time.day, clockHour: time.hour, clockMinute: time.minute };
    staffArray[currentRowIndex].duration = calculateReturnAndLateTime(value).duration;
    staffArray[currentRowIndex].expectedReturnTime = { returnMonth: time.returnMonth, returnDay: time.returnDay, returnHour: time.returnHour, returnMinute: time.returnMinute }
    /* Hide clock-out modal */
    $(".clock-out-modal").modal("hide");

    /* Assign the respective elements' values based off of the class' properties  */
    selection.find(".staff-status").html(staffArray[currentRowIndex].info.status);
    selection.find(".staff-out-time").html(`${staffArray[currentRowIndex].info.outTime.clockHour} : ${staffArray[currentRowIndex].info.outTime.clockMinute} `);
    selection.find(".staff-duration").html(staffArray[currentRowIndex].info.duration);
    selection.find(".staff-expected-return-time").html(`${staffArray[currentRowIndex].info.expectedReturnTime.returnHour} : ${staffArray[currentRowIndex].info.expectedReturnTime.returnMinute}  `);

    /* Add the class to override the bg-color of the current user staff row for clocking out */
    selection.addClass("clocked-out-selection");

    /* Get an overview over which staff is clocked out, push to an array and check if staff is already clocked out */
    if (!staffOutArray[0].includes(staffArray[currentRowIndex])) {
      const lateToast = generateStaffIsLateToast(staffArray[currentRowIndex].info.picture, staffArray[currentRowIndex].info.name, staffArray[currentRowIndex].info.surName, staffArray[currentRowIndex].info.outTime.clockHour, staffArray[currentRowIndex].info.outTime.clockMinute);
      staffOutArray[0].push(staffArray[currentRowIndex]);
      staffOutArray[1].push(lateToast);
    }

    /* Display a red highlight on the clocked out user and then remove the highlight class after specified milliseconds have passed */
    clockOutVisualConfirmation(1500);
    console.log(staffArray[currentRowIndex].info.expectedReturnTime)
  } else {
    displayError(3000);
  }
  /* Reset the input in the clock.out modal */
  $(".clock-out-modal-input").val("");
}
function staffMemberIsLate() {
  staffOutArray[0].forEach((staff, index) => {
    const currentHour = getCurrentTime().hour;
    const currentMinute = getCurrentTime().minute;
    const currentDay = getCurrentTime().day;
    const currentMonth = getCurrentTime().month;
    const staffReturnMonth = staff.info.expectedReturnTime.returnMonth;
    const staffReturnDay = staff.info.expectedReturnTime.returnDay;
    const staffReturnHour = staff.info.expectedReturnTime.returnHour;
    const staffReturnMinute = staff.info.expectedReturnTime.returnMinute;
    const lateToast = staffOutArray[1][index];

    /* Compare current time with expected return time, display alert if exceeded.*/
    if (currentMonth === staffReturnMonth && currentDay === staffReturnDay && currentHour >= staffReturnHour && currentMinute > staffReturnMinute) {
      $(lateToast).toast({ autohide: false }).appendTo(".late-toast-wrapper");
      staff.staffMemberIsLate = true;
      if (staff.info.staffMemberIsLate === true) {

        if (!lateToast.hasClass("show")) {
          lateToast.toast("show");
        } else if (lateToast.hasClass("show")) {
          /* If the toast has already been shown, remove the staff and the toast from the array */
          staffOutArray[1].splice(staffOutArray[1][index], 1);
          staffOutArray[0].splice(staffOutArray[0][index], 1);
        }
      }
    }
  });
  deleteDismissedToasts();
}
function deliveryDriverIsLate() {
  deliveryArray[0].forEach((driver, index) => {
    const currentHour = getCurrentTime().hour;
    const currentMinute = getCurrentTime().minute;
    const currentDay = getCurrentTime().day;
    const currentMonth = getCurrentTime().month;
    const driverReturnDay = driver.info.returnTime.returnDay;
    const driverReturnHour = driver.info.returnTime.returnHour;
    const driverReturnMinute = driver.info.returnTime.returnMinute;
    const driverReturnMonth = driver.info.returnTime.returnMonth;
    const lateToast = deliveryArray[1][index];

    /* Compare current time with expected return time, display alert if exceeded.*/
    if (currentMonth === driverReturnMonth && currentDay === driverReturnDay && currentHour >= driverReturnHour && currentMinute > driverReturnMinute) {
      $(lateToast).toast({ autohide: false }).appendTo(".late-toast-wrapper");
      driver.deliveryDriverIsLate = true;

      if (driver.info.deliveryDriverIsLate === true) {
        if (!lateToast.hasClass("show")) {
          lateToast.toast("show");
        } else if (lateToast.hasClass("show")) {
          /* If the toast has already been shown, remove the staff and the toast from the array */
          deliveryArray[1].splice(deliveryArray[1][index], 1);
          deliveryArray[0].splice(deliveryArray[0][index], 1);
        }
      }
    }
  });
  deleteDismissedToasts();
}
function deleteDismissedToasts() {
  $(".toast.late-toast.fade.hide").each(function () {
    let self = this;
    setTimeout(function () {
      $(self).remove();
    }, 2000);
  });
}
function generateStaffIsLateToast(picture, name, surName, clockHour, clockMinute) {
  return (lateToast = $(`
  <div class="toast late-toast" role="alert">
    <div class="toast-header w-100 bg-white d-flex justify-content-between">
      <strong class="text-danger late-toast-title">Staff Delay Alert!</strong>
      <button class="btn-close" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body late-toast-body d-flex justify-content-between flex-column">
    <p><img src='${picture}' class='rounded-1'></img> ${name} ${surName} is delayed.</p>
    <p><strong>Time out-of-office: ${clockHour}:${clockMinute}</strong></p>
    </div>
  </div>
  `)).toast({ autohide: false });
}
function generateDeliveryDriverIsLateToast(name, surName, address, telephone, returnHour, returnMinute) {
  return (lateToast = $(`
  <div class="toast late-toast" role="alert">
    <div class="toast-header w-100 bg-white d-flex justify-content-between">
      <strong class="text-danger late-toast-title">Delivery Driver Delay Alert!</strong>
      <button class="btn-close" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body late-toast-body">
    <p class='p-0 m-0'>Name: ${name} ${surName} is delayed.</p>
    <p class='p-0 m-0'>Address: ${address}</p>
    <p class='p-0 m-0'>Telephone: ${telephone}</p>
    <p class='pt-2'><strong>Estimated return time: ${returnHour}:${returnMinute}</strong></p>
    </div>
  </div>
  `)).toast({ autohide: false });
}
function getCurrentTime() {
  let time = new Date();
  let month = time.getMonth() + 1;
  let day = time.getDate();
  let hour = time.getHours();
  let minute = time.getMinutes();
  let daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return { month: month, day: day, hour: hour, minute: minute, daysInCurrentMonth: daysInCurrentMonth };
}
function clockOutVisualConfirmation(duration) {
  $(".clocked-out-selection").each(function () {
    let self = this;
    setTimeout(function () {
      $(self).removeClass("clocked-out-selection");
    }, duration);
  });
}
function clockInVisualConfirmation(duration) {
  $(".clocked-in-selection").each(function () {
    let self = this;
    setTimeout(function () {
      $(self).removeClass("clocked-in-selection");
    }, duration);
  });
}
function displayError(duration) {
  $(".clock-out-modal-input-error").addClass("visible").removeClass("hidden");
  if (errorTimeout) {
    clearTimeout(errorTimeout);
  }
  errorTimeout = setTimeout(function () {
    $(".clock-out-modal-input-error").addClass("hidden").removeClass("visible");
    errorTimeout = null;
  }, duration);
}
function addDelivery() {
  const carIcon = "<i class='fas fa-car'></i>";
  const motorcycleIcon = "<i class='fas fa-motorcycle'></i>";

  let vehicleIcon;
  let vehicleType = $(".vehicle-type-selection").val();
  let name = $(".sd-firstName").val();
  let surName = $(".sd-surName").val();
  let telephone = $(".sd-phoneNumber").val();
  let deliveryAddress = $(".sd-address").val();
  let returnTime = $(".sd-returnTime").val();
  let invalidFields = [];

  const letterRegex = /^[a-zA-Z ]{1,20}$/;
  const addressRegex = /^[a-zA-Z0-9 ,]{1,30}$/;
  const numberRegex = /^[0-9]{7,20}$/;

  switch (vehicleType) {
    case "car":
      vehicleIcon = carIcon;
      break;
    case "motorcycle":
      vehicleIcon = motorcycleIcon;
      break;
    default:
      break;
  }
  //#region Regex Validation
  if (vehicleType == "Select vehicle type") invalidFields.push({ name: "Vehicle Type", value: vehicleType });
  if (!letterRegex.test(name)) invalidFields.push({ name: "Name", value: name });
  if (!letterRegex.test(surName)) invalidFields.push({ name: "Surname", value: surName });
  if (!numberRegex.test(telephone)) invalidFields.push({ name: "Telephone", value: telephone });
  if (!addressRegex.test(deliveryAddress)) invalidFields.push({ name: "Delivery Address", value: deliveryAddress });
  if (returnTime == "") invalidFields.push({ name: "Return Time", value: returnTime })
  //#endregion

  function validateDelivery() {
    if (invalidFields.length > 0) {
      const alertModal = $(".alert-modal");
      const errorFieldsString = invalidFields.length > 1 ? " fields required!" : " field required!";
      let errorMessage = "";

      invalidFields.forEach((value) => {
        errorMessage += `${value.name}, `;
        $(".alert-modal .modal-body").html(`${errorMessage} ${errorFieldsString}`);

      });
      if (invalidFields.length == 1 && invalidFields[0].name == "Telephone") {
        $(".telephone-modal").modal("show");
      }
      else alertModal.modal("show");
    }
    else {
      const driver = new DeliveryDriver(name, surName, vehicleType, telephone, deliveryAddress, returnTime, false);
      let timeSet = $(".time-picker").val();
      let currentHour = getCurrentTime().hour;
      let currentMinute = getCurrentTime().minute;

      let returnHour = parseInt(timeSet.split(":")[0], 10);
      let returnMinute = parseInt(timeSet.split(":")[1], 10);

      let returnTotalMinutes = returnHour * 60 + returnMinute;
      let currentTotalMinutes = currentHour * 60 + currentMinute;
      let totalMinutes = 0;

      totalMinutes = (returnTotalMinutes - currentTotalMinutes);

      /*  Calculate time difference in minutes */
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
      }
      let returnAndLateTime = calculateReturnAndLateTime(totalMinutes);

      console.log("Time difference in minutes: ", totalMinutes);
      driver.returnDay = returnAndLateTime.returnDay;
      driver.returnHour = returnAndLateTime.returnHour;
      driver.returnMinute = returnAndLateTime.returnMinute;
      driver.returnMonth = returnAndLateTime.returnMonth;

      const lateToast = $(generateDeliveryDriverIsLateToast(
        driver.info.name,
        driver.info.surName,
        driver.info.deliveryAddress,
        driver.info.telephone,
        driver.info.returnTime.returnHour,
        driver.info.returnTime.returnMinute,
      ));
      deliveryArray[0].push(driver);
      deliveryArray[1].push(lateToast);

      resetInputFields();
      $(".validation-modal").modal("show");

      let driverRow = $(`<tr class='table-delivery-row'>
      <td class='delivery-vehicleType'>${vehicleIcon}</td>
      <td class='delivery-name'>${driver.info.name}</td>
      <td class='delivery-surName'>${driver.info.surName}</td>
      <td class='delivery-phone'>${driver.info.telephone}</td>
      <td class='delivery-address'>${driver.info.deliveryAddress}</td>
      <td class='delivery-returnTime'>${driver.info.returnTime.returnHour}:${driver.info.returnTime.returnMinute}</td>
    </tr>`);
      $(driverRow).appendTo(".table-delivery-body");
      console.log("Driver Return Time: ", driver.info.returnTime);
      setTimeout(() => {
        $(".validation-modal").modal("hide");
        console.log("Scheduled deliveries: ", deliveryArray);
      }, 2000);
    }
  }
  function resetInputFields() {
    vehicleType = $(".vehicle-type-selection").append('<option selected="" hidden="">Select vehicle type</option>');
    name = $(".sd-firstName").val("");
    surName = $(".sd-surName").val("");
    telephone = $(".sd-phoneNumber").val("");
    deliveryAddress = $(".sd-address").val("");
    returnTime = $(".sd-returnTime").val("");
  }
  validateDelivery();
}
function getVehicleTypeSelection() {
  const value = $(".vehicle-type-selection").val();
  return value;
}
function clearDeliveryTableRow() {
  if ($(".table-delivery-body").find(selection).hasClass("table-delivery-row")) {
    $(".schedule-delete-confirmation-modal").modal("show");
    $(".schedule-delete-confirmation-modal .confirm-btn").on('click', function () {
      $(".table-delivery-body").find(selection).addClass("collapsed");
      setTimeout(function () {
        $(".table-delivery-body").find(selection).remove();
        deliveryArray[0].splice(currentRowIndex, 1);
        deliveryArray[1].splice(currentRowIndex, 1);
        $(".schedule-delete-confirmation-modal").modal("hide");
        console.log("Scheduled deliveries: ", deliveryArray);
      }, 1000);
    })
  }
}
function calculateReturnAndLateTime(totalMinutes) {
  let currentTime = getCurrentTime();
  let daysInCurrentMonth = currentTime.daysInCurrentMonth;
  let month = currentTime.month;
  let hour = currentTime.hour;
  let minute = currentTime.minute;
  let day = currentTime.day;
  totalMinutes = parseInt(totalMinutes);

  let additionalHours = totalMinutes / 60;
  let remainingMinutes = totalMinutes % 60;

  let returnMonth = month;
  let returnDay = 0;
  let returnHour = parseInt(hour + additionalHours + Math.floor((minute + remainingMinutes) / 60)) % 24;
  let returnMinute = Math.floor(minute + remainingMinutes) % 60;
  let durationHour = Math.floor(totalMinutes / 60);
  let durationMinute = Math.floor(remainingMinutes);

  let hourString = durationHour <= 1 ? "hr" : "hrs";
  let minuteString = durationMinute <= 1 ? "min" : "mins";

  /* Add a leading 0 if minute or hour is less than 10 using ternary operations */
  hour = hour < 10 ? "0" + hour : hour;
  minute = minute < 10 ? "0" + minute : minute;
  returnHour = returnHour < 10 ? "0" + returnHour : returnHour;
  returnMinute = returnMinute < 10 ? "0" + returnMinute : returnMinute;
  returnDay = returnHour < hour ? day + 1 : day;

  if (returnDay > daysInCurrentMonth) {
    returnDay = 1;
    returnMonth = month + 1;
    if (returnMonth > 11) {
      returnMonth = 0;
    }
  }

  return {
    month: month,
    day: day,
    hour: hour,
    minute: minute,
    returnHour: returnHour,
    returnMinute: returnMinute,
    returnDay: returnDay,
    returnMonth: returnMonth,
    durationHour: durationHour,
    durationMinute: durationMinute,
    duration: `${durationHour} ${hourString} : ${durationMinute} ${minuteString}`,
  };
}
function resetClockOutInputValue() {
  $(".clock-out-modal-input").val("");
}
/* Classes */
class Employee {
  constructor(name, surName) {
    this._name = name;
    this._surName = surName;
  }
}
class StaffMember extends Employee {
  constructor(name, surName, picture, email, status, outTime, duration, expectedReturnTime, staffMemberIsLate) {
    super(name, surName);
    this._picture = picture;
    this._email = email;
    this._status = status;
    this._outTime = outTime;
    this._duration = duration;
    this._expectedReturnTime = expectedReturnTime;
    this._staffMemberIsLate = staffMemberIsLate;
  }
  get info() {
    return {
      name: this._name,
      surName: this._surName,
      picture: this._picture,
      email: this._email,
      status: this._status,
      outTime: this._outTime,
      duration: this._duration,
      expectedReturnTime: this._expectedReturnTime,
      staffMemberIsLate: this._staffMemberIsLate
    }
  }

  /**
   * @param {string} status
   */
  set status(status) {
    this._status = status;
  }
  /**
   * @param {{ clockDay: Number; clockHour: Number; clockMinute: Number; }} outTime
   */
  set outTime(outTime) {
    this._outTime = { clockDay: outTime.clockDay, clockHour: outTime.clockHour, clockMinute: outTime.clockMinute }
  }
  /**
   * @param {{ returnDay: Number; returnHour: Number; returnMinute: Number; }} expectedReturnTime
   */
  set expectedReturnTime(expectedReturnTime) {
    this._expectedReturnTime = { returnMonth: expectedReturnTime.returnMonth, returnDay: expectedReturnTime.returnDay, returnHour: expectedReturnTime.returnHour, returnMinute: expectedReturnTime.returnMinute }
  }
  /**
   * @param {boolean} staffMemberIsLate
   */
  set staffMemberIsLate(staffMemberIsLate) {
    this._staffMemberIsLate = staffMemberIsLate;
  }
  /**
   * @param {Number} duration
   */
  set duration(duration) {
    this._duration = duration;
  }
}
class DeliveryDriver extends Employee {
  constructor(name, surName, vehicle, telephone, deliveryAddress, returnTime, deliveryDriverIsLate) {
    super(name, surName);
    this._vehicle = vehicle;
    this._telephone = telephone;
    this._deliveryAddress = deliveryAddress;
    this._returnTime = {
      returnDay: 0,
      returnHour: 0,
      returnMinute: 0
    };
    this._deliveryDriverIsLate = deliveryDriverIsLate;
  }
  get info() {
    return {
      name: this._name,
      surName: this._surName,
      vehicle: this._vehicle,
      telephone: this._telephone,
      deliveryAddress: this._deliveryAddress,
      returnTime: { returnMonth: this._returnTime.returnMonth, returnDay: this._returnTime.returnDay, returnHour: this._returnTime.returnHour, returnMinute: this._returnTime.returnMinute },
      deliveryDriverIsLate: this._deliveryDriverIsLate
    }
  }
  /**
   * @param {boolean} deliveryDriverIsLate
   */
  set deliveryDriverIsLate(deliveryDriverIsLate) {
    this._deliveryDriverIsLate = deliveryDriverIsLate;
  }
  /**
   * @param {number} returnDay
   */
  set returnMonth(returnMonth) {
    this._returnTime.returnMonth = returnMonth;
  }

  set returnDay(returnDay) {
    this._returnTime.returnDay = returnDay;
  }
  /**
   * @param {number} returnHour
   */
  set returnHour(returnHour) {
    this._returnTime.returnHour = returnHour;
  }
  /**
   * @param {number} returnMinute
   */
  set returnMinute(returnMinute) {
    this._returnTime.returnMinute = returnMinute;
  }
}
