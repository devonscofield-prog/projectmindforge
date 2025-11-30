import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================================
// FormInput - Standard text/email/password input with label
// ============================================================================
export interface FormInputProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, description, required, className, id, ...props }, ref) => {
    const inputId = id || React.useId();
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;

    return (
      <div className="space-y-2">
        <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          ref={ref}
          id={inputId}
          className={cn(error && "border-destructive", className)}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          {...props}
        />
        {description && !error && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormInput.displayName = "FormInput";

// ============================================================================
// FormTextarea - Textarea with label
// ============================================================================
export interface FormTextareaProps extends React.ComponentProps<"textarea"> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, description, required, className, id, ...props }, ref) => {
    const textareaId = id || React.useId();
    const descriptionId = `${textareaId}-description`;
    const errorId = `${textareaId}-error`;

    return (
      <div className="space-y-2">
        <Label htmlFor={textareaId} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          ref={ref}
          id={textareaId}
          className={cn(error && "border-destructive", className)}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
          {...props}
        />
        {description && !error && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormTextarea.displayName = "FormTextarea";

// ============================================================================
// FormSelect - Select dropdown with label
// ============================================================================
export interface FormSelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  error?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function FormSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  error,
  description,
  required,
  disabled,
  className,
  id,
}: FormSelectProps) {
  const selectId = id || React.useId();
  const descriptionId = `${selectId}-description`;
  const errorId = `${selectId}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId} className={cn(error && "text-destructive")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={selectId}
          className={cn(error && "border-destructive", className)}
          aria-describedby={cn(description && descriptionId, error && errorId)}
          aria-invalid={!!error}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && !error && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// FormCheckbox - Checkbox with label (inline)
// ============================================================================
export interface FormCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function FormCheckbox({
  label,
  checked,
  onCheckedChange,
  description,
  disabled,
  className,
  id,
}: FormCheckboxProps) {
  const checkboxId = id || React.useId();

  return (
    <div className={cn("flex items-start space-x-2", className)}>
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="grid gap-1 leading-none">
        <Label htmlFor={checkboxId} className="text-sm font-normal cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FormSwitch - Switch with label and description (card style)
// ============================================================================
export interface FormSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "card";
  className?: string;
  id?: string;
}

export function FormSwitch({
  label,
  checked,
  onCheckedChange,
  description,
  icon,
  disabled,
  variant = "default",
  className,
  id,
}: FormSwitchProps) {
  const switchId = id || React.useId();

  if (variant === "card") {
    return (
      <div className={cn("flex items-center justify-between rounded-lg border p-3", className)}>
        <div className="space-y-0.5">
          <Label htmlFor={switchId} className="font-medium flex items-center gap-2 cursor-pointer">
            {icon}
            {label}
          </Label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={switchId} className="flex items-center gap-2 cursor-pointer">
          {icon}
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ============================================================================
// FormFieldGroup - Grid layout for multiple fields
// ============================================================================
export interface FormFieldGroupProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function FormFieldGroup({ children, columns = 2, className }: FormFieldGroupProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

// ============================================================================
// SubmitButton - Standardized submit button with loading state
// ============================================================================
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function SubmitButton({
  isLoading,
  loadingText = "Submitting...",
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={disabled || isLoading} aria-busy={isLoading} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
