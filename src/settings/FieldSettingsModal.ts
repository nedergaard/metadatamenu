import { App, Modal, Setting, TextComponent, Notice, ButtonComponent, ExtraButtonComponent, DropdownComponent } from "obsidian";
import MetadataMenu from "main";
import Field from "src/fields/Field";
import { FieldManager, FieldType, FieldTypeLabelMapping } from "src/types/fieldTypes";
import FieldSetting from "src/settings/FieldSetting";
import AbstractListBasedField from "src/fields/fieldManagers/AbstractListBasedField";
import NumberField from "src/fields/fieldManagers/NumberField";

export default class FieldSettingsModal extends Modal {
    private namePromptComponent: TextComponent;
    private valuesPromptComponents: Array<TextComponent> = [];
    private numberStepValue: TextComponent;
    private numberMinValue: TextComponent;
    private numberMaxValue: TextComponent;
    private saved: boolean = false;
    private field: Field;
    private plugin: MetadataMenu;
    private initialField: Field;
    private parentSetting?: FieldSetting;
    private new: boolean = true;
    private parentSettingContainer: HTMLElement;
    private fieldOptionsContainer: HTMLDivElement;

    constructor(app: App, plugin: MetadataMenu, parentSettingContainer: HTMLElement, parentSetting?: FieldSetting, field?: Field) {
        super(app);
        this.plugin = plugin;
        this.parentSetting = parentSetting;
        this.initialField = new Field();
        this.parentSettingContainer = parentSettingContainer;
        if (field) {
            this.new = false;
            this.field = field;
            Field.copyProperty(this.initialField, this.field)
        } else {
            let newId = 1;
            this.plugin.initialProperties.forEach(prop => {
                if (parseInt(prop.id) && parseInt(prop.id) >= newId) {
                    newId = parseInt(prop.id) + 1;
                };
            });
            this.field = new Field();
            this.field.id = newId.toString();
            this.initialField.id = newId.toString();
        };
    };

    async onOpen(): Promise<void> {
        if (this.field.name == "") {
            this.titleEl.setText(`Add a field and define options`);
        } else {
            this.titleEl.setText(`Manage settings options for ${this.field.name}`);
        };
        await this.createForm();
    };

    onClose(): void {
        Object.assign(this.field, this.initialField);
        if (!this.new && this.parentSetting) {
            this.parentSetting.setTextContentWithname()
        } else if (this.saved) {
            new FieldSetting(this.parentSettingContainer, this.field, this.app, this.plugin);
        };
    };

    private createnameInputContainer(parentNode: HTMLDivElement): TextComponent {
        const fieldNameContainerLabel = parentNode.createDiv();
        fieldNameContainerLabel.setText(`Field Name:`);
        const input = new TextComponent(parentNode);
        const name = this.field.name;
        input.setValue(name);
        input.setPlaceholder("Name of the field");
        input.onChange(value => {
            this.field.name = value;
            this.titleEl.setText(`Manage predefined options for ${this.field.name}`);
            FieldSettingsModal.removeValidationError(input);
        });
        return input;
    };

    private createTypeSelectorContainer(parentNode: HTMLDivElement): void {
        const typeSelectorContainerLabel = parentNode.createDiv();
        typeSelectorContainerLabel.setText(`Field type:`);
        const select = new DropdownComponent(parentNode);
        Object.keys(FieldTypeLabelMapping).forEach(f => select.addOption(f, f))
        if (this.field.type) {
            select.setValue(this.field.type)
        }
        select.onChange((typeLabel: keyof typeof FieldType) => {
            this.field = new Field();
            Field.copyProperty(this.field, this.initialField);
            this.field.type = FieldTypeLabelMapping[typeLabel];
            if (this.field.type !== this.initialField.type &&
                ![this.field.type, this.initialField.type].every(fieldType =>
                    [FieldType.Multi, FieldType.Select, FieldType.Cycle].includes(fieldType)
                )
            ) {
                this.field.options = {}
            }
            while (this.fieldOptionsContainer.firstChild) {
                this.fieldOptionsContainer.removeChild(this.fieldOptionsContainer.firstChild);
            }
            this.buildOptionsContainer();
        })
    }

    private buildOptionsContainer(): void {
        const fieldManager = new FieldManager[this.field.type](this.field);
        if (
            fieldManager.field.type === FieldType.Select ||
            fieldManager.field.type === FieldType.Multi ||
            fieldManager.field.type === FieldType.Cycle
        ) {
            (fieldManager as AbstractListBasedField).createSettingContainer(this.fieldOptionsContainer);
        } else if (fieldManager.field.type === FieldType.Number) {
            (fieldManager as NumberField).createSettingContainer(this.fieldOptionsContainer);
        }
    }

    private async createForm(): Promise<void> {
        const div = this.contentEl.createDiv({
            cls: "metadata-menu-prompt-div"
        });
        const mainDiv = div.createDiv({
            cls: "metadata-menu-prompt-form"
        });
        /* Field Name Section */
        const nameContainer = mainDiv.createDiv();
        this.namePromptComponent = this.createnameInputContainer(nameContainer);

        mainDiv.createDiv({ cls: 'metadata-menu-separator' }).createEl("hr");

        /* Field type selection */
        const typeSelectContainer = mainDiv.createDiv()

        /* Field options section*/
        this.fieldOptionsContainer = mainDiv.createDiv()

        /* footer buttons*/
        const footerEl = this.contentEl.createDiv();
        const footerButtons = new Setting(footerEl);
        footerButtons.addButton((b) => this.createSaveButton(b));
        footerButtons.addExtraButton((b) => this.createCancelButton(b));

        /* init state */
        this.createTypeSelectorContainer(typeSelectContainer)
        this.buildOptionsContainer();
    };

    private validateFields(): boolean {
        let error = false;
        if (/^[#>-]/.test(this.field.name)) {
            FieldSettingsModal.setValidationError(
                this.namePromptComponent, this.namePromptComponent.inputEl,
                "Field name cannot start with #, >, -"
            );
            error = true;
        };
        if (this.field.name == "") {
            FieldSettingsModal.setValidationError(
                this.namePromptComponent, this.namePromptComponent.inputEl,
                "Field name can not be Empty"
            );
            error = true;
        };
        if (this.field.type !== FieldType.Number) {
            this.valuesPromptComponents.forEach(input => {
                if (/^[#>-]/.test(input.inputEl.value) && input.inputEl.parentElement?.lastElementChild) {
                    FieldSettingsModal.setValidationError(
                        input, input.inputEl.parentElement.lastElementChild,
                        "Values cannot cannot start with #, >, -"
                    );
                    error = true;
                };
                if (/[,]/gu.test(input.inputEl.value) && input.inputEl.parentElement?.lastElementChild) {
                    FieldSettingsModal.setValidationError(
                        input, input.inputEl.parentElement.lastElementChild,
                        "Values cannot contain a comma"
                    );
                    error = true;
                };
                if (input.inputEl.value == "" && input.inputEl.parentElement?.lastElementChild) {
                    FieldSettingsModal.setValidationError(
                        input, input.inputEl.parentElement.lastElementChild,
                        "Values can't be null."
                    );
                    error = true;
                };
            });
        } else {
            if (this.field.options.step && isNaN(parseFloat(this.field.options.step))) {
                FieldSettingsModal.setValidationError(
                    this.numberStepValue, this.numberStepValue.inputEl,
                    "Values must be numeric."
                );
                error = true;
            }
            if (this.field.options.min && isNaN(parseFloat(this.field.options.min))) {
                FieldSettingsModal.setValidationError(
                    this.numberMinValue, this.numberMinValue.inputEl,
                    "Values must be numeric."
                );
                error = true;
            }
            if (this.field.options.max && isNaN(parseFloat(this.field.options.max))) {
                FieldSettingsModal.setValidationError(
                    this.numberMaxValue, this.numberMaxValue.inputEl,
                    "Values must be numeric."
                );
                error = true;
            }
        }
        return error
    }

    private createSaveButton(b: ButtonComponent): ButtonComponent {
        b.setTooltip("Save");
        b.setIcon("checkmark");
        b.onClick(async () => {
            let error = this.validateFields()
            if (error) {
                new Notice("Fix errors before saving.");
                return;
            };
            this.saved = true;
            const currentExistingField = this.plugin.initialProperties.filter(p => p.id == this.field.id)[0];
            if (currentExistingField) {
                Field.copyProperty(currentExistingField, this.field);
            } else {
                this.plugin.initialProperties.push(this.field);
            };
            Field.copyProperty(this.initialField, this.field)
            Field.copyProperty(this.parentSetting!.field, this.field)
            this.parentSetting?.setTextContentWithname()
            this.plugin.saveSettings();
            this.close();
        });
        return b;
    };

    private createCancelButton(b: ExtraButtonComponent): ExtraButtonComponent {
        b.setIcon("cross")
            .setTooltip("Cancel")
            .onClick(() => {
                this.saved = false;
                /* reset options from settings */
                if (this.initialField.name != "") {
                    Object.assign(this.field, this.initialField);
                };
                this.close();
            });
        return b;
    };

    /* utils functions */

    public static setValidationError(textInput: TextComponent, insertAfter: Element, message?: string) {
        textInput.inputEl.addClass("is-invalid");
        if (message && textInput.inputEl.parentElement?.lastElementChild) {

            let mDiv = textInput.inputEl.parentElement.querySelector(
                ".invalid-feedback"
            ) as HTMLDivElement;

            if (!mDiv) {
                mDiv = createDiv({ cls: "invalid-feedback" });
            }
            mDiv.innerText = message;
            mDiv.insertAfter(insertAfter);
        }
    }
    public static removeValidationError(textInput: TextComponent) {
        if (textInput.inputEl.hasClass("is-invalid") && textInput.inputEl.parentElement?.lastElementChild) {
            textInput.inputEl.removeClass("is-invalid")
            textInput.inputEl.parentElement.removeChild(
                textInput.inputEl.parentElement.lastElementChild
            );
        };
    };
};