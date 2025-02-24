#!/bin/sh   
REPO_NAME=$1
IMAGE_DIGEST=$2  
AWS_REGION=$3  
echo "$IMAGE_DIGEST"
aws ecr batch-delete-image --repository-name $REPO_NAME --image-ids imageDigest="$IMAGE_DIGEST" --region $AWS_REGION