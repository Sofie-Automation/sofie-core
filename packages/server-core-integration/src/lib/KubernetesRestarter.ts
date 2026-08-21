import { AppsV1Api, KubeConfig, PatchStrategy, setHeaderOptions } from '@kubernetes/client-node'
import * as fs from 'node:fs/promises'
import type { SomeLogger } from './types.js'

export class KubernetesRestarter {
	private static namespaceCache: string | null = null
	static async getNamespace(): Promise<string> {
		KubernetesRestarter.namespaceCache ??= (
			await fs.readFile('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8')
		).trim()
		if (!KubernetesRestarter.namespaceCache)
			throw new Error('Kubernetes namespace secret could not be read from file')

		return KubernetesRestarter.namespaceCache
	}
	static readonly k8sConfig = {
		runs_on_k8s: `${process.env.RUNS_ON_K8S}`.toLowerCase() === 'true',
	}
	static canUseK8sRestarter(): boolean {
		return KubernetesRestarter.k8sConfig.runs_on_k8s
	}
	private readonly k8sApi: AppsV1Api
	private readonly deploymentName: string
	constructor(
		private readonly logger: SomeLogger,
		defaultDeploymentName: string
	) {
		const kc = new KubeConfig()
		kc.loadFromDefault()

		this.k8sApi = kc.makeApiClient(AppsV1Api)

		this.deploymentName = process.env.DEPLOYMENT_NAME || defaultDeploymentName
		if (!this.deploymentName) throw new Error('Deployment name is empty string, cannot restart')
	}
	async restartKube(): Promise<void> {
		this.logger.info(`Attempting to restart Kubernetes deployment: ${this.deploymentName}`)
		try {
			const patch = {
				spec: {
					template: {
						metadata: {
							annotations: {
								'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
							},
						},
					},
				},
			}
			const namespace = await KubernetesRestarter.getNamespace()

			await this.k8sApi.patchNamespacedDeployment(
				{
					name: this.deploymentName,
					namespace,
					body: patch,
				},
				setHeaderOptions('Content-Type', PatchStrategy.JsonPatch)
			)
			this.logger.info(
				`Patched k8s deployment ${this.deploymentName} on namespace ${namespace} to trigger restart`
			)
		} catch (err: any) {
			this.logger.error(`Full error: ${JSON.stringify(err, null, 2)}`)
			throw err
		}
	}
}
