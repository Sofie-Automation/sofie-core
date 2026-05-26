import { AppsV1Api, KubeConfig, PatchStrategy, setHeaderOptions } from '@kubernetes/client-node'
import fs from 'node:fs'
import { Logger } from 'winston'

export class KubernetesRestarter {
	private static namespaceCache: string | null = null
	static async getNamespace(): Promise<string> {
		KubernetesRestarter.namespaceCache ??= (
			await fs.promises.readFile('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8')
		).trim()
		return KubernetesRestarter.namespaceCache
	}
	static readonly k8sConfig = {
		deployment_name: process.env.DEPLOYMENT_NAME || 'sofie-playout-gateway',
		runs_on_k8s: `${process.env.RUNS_ON_K8S}.toLocaleLowerCase` === 'true',
	}
	static canUseK8sRestarter(): boolean {
		return KubernetesRestarter.k8sConfig.runs_on_k8s
	}
	private readonly k8sApi: AppsV1Api
	constructor(private readonly logger: Logger) {
		const kc = new KubeConfig()
		kc.loadFromDefault()

		this.k8sApi = kc.makeApiClient(AppsV1Api)
	}
	async restartKube(): Promise<void> {
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
			this.logger.info(`k8sConfig ${JSON.stringify(KubernetesRestarter.k8sConfig)}`)
			const res = await this.k8sApi.patchNamespacedDeployment(
				{
					name: KubernetesRestarter.k8sConfig.deployment_name,
					namespace: namespace,
					body: patch,
				},
				setHeaderOptions('Content-Type', PatchStrategy.JsonPatch)
			)
			this.logger.info(`response from k8s patch ${JSON.stringify(res)}`)
		} catch (err) {
			this.logger.error(err)
		}
	}
}
