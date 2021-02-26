/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { fireEvent, registerListener, unregisterAllListeners } from 'c/statusCardPubsub';
import userId from '@salesforce/user/Id';
import getListViews from '@salesforce/apex/StatusCardController.getListViews';
import getListRecords from '@salesforce/apex/StatusCardController.getListRecords';
import getUserData from '@salesforce/apex/StatusCardController.getUserData';
import saveUserData from '@salesforce/apex/StatusCardController.saveUserData';

import StatusCard_UpdateErrorTitle from '@salesforce/label/c.StatusCard_UpdateErrorTitle';
import StatusCard_UpdateErrorMessage from '@salesforce/label/c.StatusCard_UpdateErrorMessage';
import StatusCard_DefaultNumberText from '@salesforce/label/c.StatusCard_DefaultNumberText';
import StatusCard_BackgroundColorOptions from '@salesforce/label/c.StatusCard_BackgroundColorOptions';
import StatusCard_SaveButton from '@salesforce/label/c.StatusCard_SaveButton';
import StatusCard_CloseButton from '@salesforce/label/c.StatusCard_CloseButton';
import StatusCard_FallbackColor from '@salesforce/label/c.StatusCard_FallbackColor';

export default class StatusCard extends NavigationMixin(LightningElement) {
  label = {
    StatusCard_UpdateErrorTitle,
    StatusCard_UpdateErrorMessage,
    StatusCard_DefaultNumberText,
    StatusCard_BackgroundColorOptions,
    StatusCard_SaveButton,
    StatusCard_CloseButton,
    StatusCard_FallbackColor
  };
  @api isTransparent;
  isActive = false;
  isChanged = false;
  userData = undefined;
  listViews = [];

  @wire(CurrentPageReference) pageRef;

  lwcElement;
  loadingEl;
  statuscardEl;
  editButton;
  reloadButton;
  newButton;
  modal;
  backdrop;
  closeButton;
  saveButton;
  alertsEl;

  initializeComponent() {
    this.lwcElement = this.template.querySelector('.lightning-status-card');
    this.loadingEl = this.template.querySelector('.loading');
    this.statuscardEl = this.template.querySelector('.home');
    this.editButton = this.template.querySelector('.edit-button');
    this.reloadButton = this.template.querySelector('.reload-button');
    this.newButton = this.template.querySelector('.new-button');
    this.modal = this.template.querySelector('.slds-modal');
    this.backdrop = this.template.querySelector('.slds-backdrop');
    this.closeButton = this.template.querySelector('.btn-close');
    this.saveButton = this.template.querySelector('.btn-save');
    this.alertsEl = this.template.querySelector('.alerts');

    this.editButton.addEventListener('click', (event) => {
      if (this.statuscardEl.dataset.mode === 'view') {
        this.statuscardEl.dataset.mode = 'edit';
      } else {
        this.saveUserData((result) => {
          if (!result) {
            const evt = new ShowToastEvent({
              title: this.label.StatusCard_UpdateErrorTitle,
              message: this.label.StatusCard_UpdateErrorMessage,
              variant: 'error'
            });
            this.dispatchEvent(evt);
          }

          fireEvent(this.pageRef, 'statusCardUpdate', null);
        });
      }
    });

    this.reloadButton.addEventListener('click', (event) => {
      this.getUserData();
    });

    this.newButton.addEventListener('click', (event) => {
      this.generateStatusCard(false);
    });

    fireEvent(this.pageRef, 'statusCardUpdate', null);
  }

  renderedCallback() {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this.initializeComponent();
  }

  showModal(data, onSave = () => {}) {
    const closeme = (event) => {
      removeListeners();
    };
    const saveme = (event) => {
      removeListeners();
      onSave();
    };

    const removeListeners = () => {
      this.modal.classList.remove('slds-fade-in-open');
      this.backdrop.classList.remove('slds-backdrop_open');
      this.closeButton.removeEventListener('click', closeme);
      this.saveButton.removeEventListener('click', saveme);

      for (const el of this.modal.querySelectorAll('[data-condition]')) {
        let colorpicker = el.querySelector('.alert-color .alert-color-picker');
        if (colorpicker) {
          colorpicker.removeEventListener('click', setColor);
        }
        let colorpicker2 = el.querySelector('.alert-color input');
        if (colorpicker2) {
          colorpicker2.removeEventListener('change', setColor2);
        }
      }
    };

    const addListeners = () => {
      this.closeButton.addEventListener('click', closeme);
      this.saveButton.addEventListener('click', saveme);

      for (const el of this.modal.querySelectorAll('[data-condition]')) {
        let _data = data.bg[el.dataset.condition];
        if (_data.color) {
          el.querySelector('.alert-color input').value = _data.color;
          el.querySelector('.alert-color input').addEventListener('change', setColor2);
          el.querySelector('.alert-color .alert-color-picker').style.backgroundColor = _data.color;
          el.querySelector('.alert-color .alert-color-picker').addEventListener('click', setColor);
        }

        if (_data.th) {
          el.querySelector('.condition-choice .slds-input').value = _data.th;
        }

        if (_data.op) {
          el.querySelector('.condition-choice .slds-select').value = _data.op;
        }
      }
    };

    const setColor = (event) => {
      let parent = event.target.parentElement;
      let picker = parent.querySelector('INPUT')[0];
      picker.click();
    };

    const setColor2 = (event) => {
      let parent = event.target.parentElement;
      parent.querySelector('.alert-color-picker').style.backgroundColor = event.target.value;
    };

    this.modal.classList.add('slds-fade-in-open');
    this.backdrop.classList.add('slds-backdrop_open');

    addListeners();
  }

  getUserData() {
    const display = () => {
      if (this.isTransparent) {
        this.statuscardEl.classList.remove('slds-card');
      } else {
        this.statuscardEl.classList.add('slds-card');
      }

      if (!this.userData.sttscard__Data__c || !this.userData.sttscard__Data__c.alerts || this.userData.sttscard__Data__c.alerts.length == 0) {
        this.statuscardEl.dataset.mode = 'edit';
        this.loadingEl.dataset.mode = 'hide';
      } else {
        this.getList((result) => {
          this.statuscardEl.dataset.mode = 'view';

          if (!result) {
            return;
          }

          this.removeAllChildNode(this.alertsEl);

          for (const alert of this.userData.sttscard__Data__c.alerts) {
            this.generateStatusCard(alert);
          }
        });
      }
    };

    getUserData({ userId: userId })
      .then(
        (_userData) => {
          (this.userData = _userData), (this.userData.sttscard__Data__c = JSON.parse(decodeURIComponent(escape(atob(_userData.sttscard__Data__c)))));
        },
        (error) => {
          this.userData = {
            Id: undefined,
            sttscard__User__c: userId,
            sttscard__Data__c: {
              counter: 0,
              alerts: []
            }
          };
          this.isChanged = true;
        }
      )
      .finally(display);
  }

  saveUserData(callback = (result) => {}) {
    if (!this.isChanged) {
      return callback(false);
    }

    let record = {
      Id: this.userData.Id,
      sttscard__User__c: this.userData.sttscard__User__c,
      sttscard__Data__c: btoa(unescape(encodeURIComponent(JSON.stringify(this.userData.sttscard__Data__c))))
    };

    saveUserData({ record: record }).then(
      (result) => {
        if (result == 'NG') {
          callback(false);
          return;
        }
        this.userData.Id = result;
        this.isChanged = false;
        callback(true);
      },
      (error) => {
        console.log('[ERROR] User data save failed', error, this.userData);
        callback(false);
      }
    );
  }

  generateStatusCard(lrecord, callback = (DOM) => {}) {
    this.loadingEl.dataset.mode = 'show';
    const generate = (result) => {
      if (!result) {
        return false;
      }

      if (!lrecord) {
        lrecord = {
          id: this.userData.sttscard__Data__c.counter++,
          listId: this.listViews[0].Id,
          mode: 'light',
          suffix: this.label.StatusCard_DefaultNumberText,
          count: undefined,
          bg: {
            0: {
              color: '#1589ee'
            },
            1: {
              op: '<',
              th: undefined,
              color: '#c23934'
            },
            2: {
              op: '<',
              th: undefined,
              color: '#fff03f'
            },
            3: {
              op: '>=',
              th: undefined,
              color: '#4bca81'
            }
          }
        };
        this.isChanged = true;
        this.userData.sttscard__Data__c.alerts.push(lrecord);
      }

      const OPTIONSDOM = (() => {
        let OPTDOM = [];
        for (const record of this.listViews) {
          const label = record.Label || record.SobjectType;
          const optionElm = document.createElement('option');
          optionElm.value = record.Id;
          optionElm.appendChild(document.createTextNode(`${label} - ${record.Name}`));

          if (lrecord.listId == record.Id) {
            optionElm.setAttribute('selected', 'selected');
          }

          OPTDOM.push(optionElm);
        }

        return OPTDOM;
      })();

      const _DOM = document.createElement('li');
      _DOM.dataset.alert = lrecord.id;
      this.alertsEl.appendChild(_DOM);

      /* start li status-card-view-01 */
      const div_AlertObject01 = document.createElement('div');
      div_AlertObject01.classList.add('alert-object');
      div_AlertObject01.appendChild(document.createTextNode('...'));

      const div_AlertLabel = document.createElement('div');
      div_AlertLabel.classList.add('alert-label');
      div_AlertLabel.appendChild(document.createTextNode('...'));

      const li_StatusCardView01 = document.createElement('li');
      li_StatusCardView01.classList.add('status-card-view-01');
      li_StatusCardView01.appendChild(div_AlertObject01);
      li_StatusCardView01.appendChild(div_AlertLabel);
      /* end li status-card-view-01 */

      /* start li status-card-view-02 */
      const div_AlertObject02 = document.createElement('div');
      div_AlertObject02.classList.add('alert-count');
      div_AlertObject02.appendChild(document.createTextNode('...'));

      const li_StatusCardView02 = document.createElement('li');
      li_StatusCardView02.classList.add('status-card-view-02', 'flex-fixed');
      li_StatusCardView02.appendChild(div_AlertObject02);
      /* end li status-card-view-02 */

      /* start ul flex-box */
      const ul_FlexBox01 = document.createElement('ul');
      ul_FlexBox01.classList.add('flex-box');
      ul_FlexBox01.appendChild(li_StatusCardView01);
      ul_FlexBox01.appendChild(li_StatusCardView02);
      /* end ul flex-box */

      /* start div status-card-view */
      const div_StatusCardView = document.createElement('div');
      div_StatusCardView.classList.add('status-card-view');
      div_StatusCardView.appendChild(ul_FlexBox01);
      /* end div status-card-view */

      /* start li status-card-edit-01 */
      const select_alertSelect01 = document.createElement('select');
      select_alertSelect01.classList.add('slds-select');

      OPTIONSDOM.forEach((optionElm) => {
        select_alertSelect01.appendChild(optionElm);
      });

      const div_alertSelect01 = document.createElement('div');
      div_alertSelect01.classList.add('alert-select');
      div_alertSelect01.appendChild(select_alertSelect01);

      const li_StatusCardEdit01 = document.createElement('li');
      li_StatusCardEdit01.classList.add('status-card-edit-01');
      li_StatusCardEdit01.appendChild(div_alertSelect01);
      /* end li status-card-edit-01 */

      /* start li status-card-edit-02 */
      const input_alertSuffix = document.createElement('input');
      input_alertSuffix.classList.add('alert-suffix');
      input_alertSuffix.value = lrecord.suffix;

      const li_StatusCardEdit02 = document.createElement('li');
      li_StatusCardEdit02.classList.add('status-card-edit-01-b', 'flex-fixed');
      li_StatusCardEdit02.appendChild(input_alertSuffix);
      /* end li status-card-edit-02 */

      /* start li status-card-edit-03 */
      const div_alertTextColor = document.createElement('div');
      div_alertTextColor.classList.add('alert-text-color');
      div_alertTextColor.appendChild(document.createTextNode('T'));

      const li_StatusCardEdit03 = document.createElement('li');
      li_StatusCardEdit03.classList.add('status-card-edit-02', 'flex-fixed');
      li_StatusCardEdit03.appendChild(div_alertTextColor);
      /* end li status-card-edit-03 */

      /* start li status-card-edit-04 */
      const div_alertColorPicker = document.createElement('div');
      div_alertColorPicker.classList.add('alert-color-picker');

      const div_alertColor = document.createElement('div');
      div_alertColor.classList.add('alert-color');
      div_alertColor.appendChild(div_alertColorPicker);

      const li_StatusCardEdit04 = document.createElement('li');
      li_StatusCardEdit04.classList.add('status-card-edit-03', 'flex-fixed');
      li_StatusCardEdit04.appendChild(div_alertColor);
      /* end li status-card-edit-04 */

      /* start div status-card-delete */
      const div_StatusCardDelete = document.createElement('div');
      div_StatusCardDelete.classList.add('status-card-delete');
      div_StatusCardDelete.appendChild(document.createTextNode('−'));
      /* end div status-card-delete */

      /* start ul flex-box */
      const ul_FlexBox02 = document.createElement('ul');
      ul_FlexBox02.classList.add('flex-box');
      ul_FlexBox02.appendChild(li_StatusCardEdit01);
      ul_FlexBox02.appendChild(li_StatusCardEdit02);
      ul_FlexBox02.appendChild(li_StatusCardEdit03);
      ul_FlexBox02.appendChild(li_StatusCardEdit04);
      /* end ul flex-box */

      /* start div status-card-edit */
      const div_StatusCardEdit = document.createElement('div');
      div_StatusCardEdit.classList.add('status-card-edit');
      div_StatusCardEdit.appendChild(div_StatusCardDelete);
      div_StatusCardEdit.appendChild(ul_FlexBox02);
      /* end div status-card-edit */

      /* end div status-card */
      const div_StatusCard = document.createElement('div');
      div_StatusCard.classList.add('status-card');
      div_StatusCard.dataset.mode = lrecord.mode;
      div_StatusCard.appendChild(div_StatusCardView);
      div_StatusCard.appendChild(div_StatusCardEdit);
      /* start div status-card */

      _DOM.appendChild(div_StatusCard);
      let statusCard = div_StatusCard;

      _DOM.addEventListener('click', (event) => {
        if (this.statuscardEl.dataset.mode === 'view') {
          for (const record of this.listViews) {
            if (record.Id === lrecord.listId) {
              this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                  objectApiName: record.SobjectType,
                  actionName: 'list'
                },
                state: {
                  filterName: record.Id
                }
              });
            }
          }
        }
      });

      let colorPicker = statusCard.querySelector('.alert-color-picker');
      colorPicker.style.backgroundColor = lrecord.bg['0'].color;
      colorPicker.addEventListener('click', (event) => {
        this.showModal(lrecord, setBackgroundColor);
      });

      const applyBackgroundColor = () => {
        const getCondition = (oper, th) => {
          if (typeof lrecord.count == 'undefined') {
            return false;
          }
          switch (oper) {
            case '>':
              return parseInt(lrecord.count) > parseInt(th);
            case '>=':
              return parseInt(lrecord.count) >= parseInt(th);
            case '==':
              return parseInt(lrecord.count) == parseInt(th);
            case '<':
              return parseInt(lrecord.count) < parseInt(th);
            case '<=':
              return parseInt(lrecord.count) <= parseInt(th);
            default:
              return false;
          }
        };

        if (typeof lrecord.bg['1'].th != 'undefined' && getCondition(lrecord.bg['1'].op, lrecord.bg['1'].th)) {
          statusCard.style.backgroundColor = lrecord.bg['1'].color;
        } else if (typeof lrecord.bg['2'].th != 'undefined' && getCondition(lrecord.bg['2'].op, lrecord.bg['2'].th)) {
          statusCard.style.backgroundColor = lrecord.bg['2'].color;
        } else if (typeof lrecord.bg['3'].th != 'undefined' && getCondition(lrecord.bg['3'].op, lrecord.bg['3'].th)) {
          statusCard.style.backgroundColor = lrecord.bg['3'].color;
        } else {
          statusCard.style.backgroundColor = lrecord.bg['0'].color;
        }
      };
      applyBackgroundColor();

      const setBackgroundColor = () => {
        for (const el of this.modal.querySelectorAll('[data-condition]')) {
          let _data = lrecord.bg[el.dataset.condition];

          let colorpicker = el.querySelector('.alert-color input');
          if (colorpicker) {
            _data.color = colorpicker.value;
          }

          let thresh = el.querySelector('.condition-choice .slds-input');
          if (thresh) {
            _data.th = thresh.value;
          }

          let opt = el.querySelector('.condition-choice .slds-select');
          if (opt) {
            _data.op = opt.value;
          }
        }

        applyBackgroundColor(lrecord.count);
        this.isChanged = true;
      };

      let suffixInpt = statusCard.querySelector('INPUT.alert-suffix');
      suffixInpt.addEventListener('keyup', (event) => {
        if (suffixInpt.value.trim().length > 0) {
          lrecord.suffix = suffixInpt.value.trim();
          this.isChanged = true;

          let alertCountEl = statusCard.querySelector('.alert-count');
          let countNode;

          this.removeAllChildNode(alertCountEl);

          if (alertCountEl.dataset.count) {
            countNode = document.createTextNode(`${alertCountEl.dataset.count} ${lrecord.suffix}`);
          }
          if (lrecord.count) {
            countNode = document.createTextNode(`${lrecord.count} ${lrecord.suffix}`);
          }

          alertCountEl.appendChild(countNode);
        }
      });

      let textColorPicker = statusCard.querySelector('.alert-text-color');
      textColorPicker.addEventListener('click', (event) => {
        if (statusCard.dataset.mode === 'dark') {
          statusCard.dataset.mode = 'light';
        } else {
          statusCard.dataset.mode = 'dark';
        }
        lrecord.mode = statusCard.dataset.mode;
        this.isChanged = true;
      });

      const setLabel = () => {
        for (const record of this.listViews) {
          if (record.Id === lrecord.listId) {
            let alertCountEl = statusCard.querySelector('.alert-count');
            this.removeAllChildNode(alertCountEl).appendChild(document.createTextNode('Loading...'));
            this.removeAllChildNode(statusCard.querySelector('.alert-label')).appendChild(document.createTextNode(record.Name));

            getListRecords({
              objectName: record.SobjectType,
              listViewId: lrecord.listId
            }).then((data) => {
              const dataJson = JSON.parse(data);
              this.removeAllChildNode(statusCard.querySelector('.alert-object')).appendChild(document.createTextNode(dataJson.label));
              lrecord.count = dataJson.size;
              const replaceText = lrecord.count != null ? `${lrecord.count} ${lrecord.suffix}` : 'Access Error';
              this.removeAllChildNode(alertCountEl).appendChild(document.createTextNode(replaceText));
              applyBackgroundColor();
            });

            return true;
          }
        }
      };

      let selectPicker = statusCard.querySelector('.slds-select');
      selectPicker.addEventListener('change', (event) => {
        this.isChanged = true;
        lrecord.listId = selectPicker.options[selectPicker.selectedIndex].value;
        setLabel();
      });

      let statuscardDelete = statusCard.querySelector('.status-card-delete');
      statuscardDelete.addEventListener('click', (event) => {
        const findUserDataIndex = this.userData.sttscard__Data__c.alerts.findIndex((alert) => alert === lrecord);
        if (findUserDataIndex > 0) {
          this.userData.sttscard__Data__c.alerts.splice(findUserDataIndex, 1);
        }
        statusCard.classList.remove('show');
        this.alertsEl.removeChild(_DOM);
        this.isChanged = true;
      });

      setLabel();
      callback(_DOM);
      statusCard.classList.add('show');
      this.loadingEl.dataset.mode = 'hide';
    };
    this.getList(generate);
  }

  getList(callback = (list) => {}) {
    if (this.listViews.length > 0) {
      callback(this.listViews);
      return;
    }
    getListViews().then(
      (_listViews) => {
        this.listViews = JSON.parse(_listViews);
        callback(this.listViews);
      },
      (error) => {
        callback(false);
      }
    );
  }

  connectedCallback() {
    registerListener('statusCardUpdate', this.getUserData, this);
  }

  disconnectedCallback() {
    this.isActive = false;
    unregisterAllListeners(this);
  }

  removeAllChildNode(elm) {
    //全子要素削除
    while (elm && elm.firstChild) {
      elm.removeChild(elm.firstChild);
    }

    return elm;
  }
}