'use strict';

import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { kubeChannel } from '../../kubeChannel';
import { ExecResult } from '../../binutilplusplus';

const HYPERLIGHT_ANNOTATION = 'hyperlight.azure.com/hyper-pod-enabled';
const HYPERLIGHT_RUNTIME_CLASS = 'hyperlight';

const DEFAULT_POD_MANIFEST = (name: string, namespace: string, image: string) => `
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
  annotations:
    ${HYPERLIGHT_ANNOTATION}: "true"
  labels:
    app.kubernetes.io/managed-by: vscode-kubernetes-tools
    hyperlight.azure.com/isolation: "true"
spec:
  runtimeClassName: ${HYPERLIGHT_RUNTIME_CLASS}
  containers:
  - name: workload
    image: ${image}
    resources:
      limits:
        memory: "128Mi"
        cpu: "500m"
`.trim();

export async function createHyperlightHyperPod(kubectl: Kubectl): Promise<void> {
    const podName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the Hyperlight Hyper Pod',
        placeHolder: 'my-hyperlight-pod',
        validateInput: (value) => {
            if (!value) { return 'Pod name is required'; }
            if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value)) {
                return 'Must be a valid Kubernetes name (lowercase alphanumeric and hyphens)';
            }
            return undefined;
        }
    });

    if (!podName) {
        return;
    }

    const namespace = await vscode.window.showInputBox({
        prompt: 'Enter the target namespace',
        placeHolder: 'default',
        value: 'default'
    });

    if (!namespace) {
        return;
    }

    const image = await vscode.window.showInputBox({
        prompt: 'Enter the container image for the workload',
        placeHolder: 'mcr.microsoft.com/hyperlight/samples/hello:latest',
        value: 'mcr.microsoft.com/hyperlight/samples/hello:latest'
    });

    if (!image) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Create Hyperlight Hyper Pod "${podName}" in namespace "${namespace}"?\n\n` +
        `Image: ${image}\n` +
        `Runtime: ${HYPERLIGHT_RUNTIME_CLASS} (micro-VM isolation)`,
        { modal: true },
        'Create'
    );

    if (confirm !== 'Create') {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Creating Hyperlight Hyper Pod "${podName}"...`,
            cancellable: false
        },
        async () => {
            const manifest = DEFAULT_POD_MANIFEST(podName, namespace, image);

            const result = await kubectl.invokeCommand(
                `apply -f -`,
                manifest
            );

            if (ExecResult.failed(result)) {
                const errMsg = ExecResult.failureMessage(result, { whatFailed: 'Create Hyperlight Hyper Pod' });
                vscode.window.showErrorMessage(`Failed to create Hyperlight Hyper Pod: ${errMsg}`);
                kubeChannel.showOutput(`Hyperlight pod creation failed: ${errMsg}`, 'Hyperlight');
                return;
            }

            kubeChannel.showOutput(
                `Hyperlight Hyper Pod created successfully!\n\n` +
                `  Name:      ${podName}\n` +
                `  Namespace: ${namespace}\n` +
                `  Image:     ${image}\n` +
                `  Runtime:   ${HYPERLIGHT_RUNTIME_CLASS}\n\n` +
                `The pod workload will run inside a Hyperlight micro-VM for safe execution.\n\n` +
                `Applied manifest:\n${manifest}`,
                'Hyperlight'
            );

            vscode.window.showInformationMessage(
                `Hyperlight Hyper Pod "${podName}" created. Workload runs in micro-VM isolation.`
            );
        }
    );
}

